/*
 * memwasi.js — a tiny in-memory WASI (preview1) implementation, just enough for
 * the TiEmu WebAssembly core. Files live in a Map<string, Uint8Array>.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const ERRNO = { SUCCESS: 0, BADF: 8, INVAL: 28, NOENT: 44, NOSYS: 52, NOTDIR: 54, ISDIR: 31, EXIST: 20 };
  const FILETYPE = { DIRECTORY: 3, REGULAR: 4, CHAR: 2 };
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  class MemFS {
    constructor() { this.files = new Map(); this.dirs = new Set(['/', '/tmp', '/data']); }
    norm(p) {
      const parts = [];
      for (const s of p.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return '/' + parts.join('/');
    }
    write(path, bytes) { this.files.set(this.norm(path), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); }
    read(path) { return this.files.get(this.norm(path)) || null; }
    exists(path) { const p = this.norm(path); return this.files.has(p) || this.dirs.has(p); }
    remove(path) { this.files.delete(this.norm(path)); }
  }

  class OpenFile {
    constructor(fs, path, append) { this.fs = fs; this.path = path; this.pos = 0; this.append = append; }
    get data() { return this.fs.files.get(this.path); }
    set data(v) { this.fs.files.set(this.path, v); }
  }

  class MemWASI {
    constructor(fs, opts = {}) {
      this.fs = fs;
      this.stdout = opts.stdout || ((s) => console.log(s));
      this.stderr = opts.stderr || ((s) => console.warn(s));
      this.fds = new Map();
      this.fds.set(3, { dir: '/', preopen: '/' });
      this.nextFd = 4;
      this.lineBuf = { 1: '', 2: '' };
      this.memory = null;
      this.imports = this.makeImports();
    }
    setMemory(mem) { this.memory = mem; }
    dv() { return new DataView(this.memory.buffer); }
    u8() { return new Uint8Array(this.memory.buffer); }
    str(ptr, len) { return dec.decode(this.u8().subarray(ptr, ptr + len)); }
    resolve(dirfd, ptr, len) {
      const d = this.fds.get(dirfd);
      if (!d || d.dir === undefined) return null;
      const rel = this.str(ptr, len);
      return this.fs.norm(rel.startsWith('/') ? rel : d.dir + '/' + rel);
    }
    flushOut(fd, text) {
      this.lineBuf[fd] += text;
      let i;
      while ((i = this.lineBuf[fd].indexOf('\n')) >= 0) {
        const line = this.lineBuf[fd].slice(0, i);
        this.lineBuf[fd] = this.lineBuf[fd].slice(i + 1);
        (fd === 1 ? this.stdout : this.stderr)(line);
      }
    }
    makeImports() {
      const self = this;
      const W = {
        fd_close(fd) { if (fd > 3) self.fds.delete(fd); return ERRNO.SUCCESS; },
        clock_time_get(id, precision, outPtr) {
          const ns = BigInt(Math.round((id === 0 ? Date.now() : performance.now()) * 1e6));
          self.dv().setBigUint64(outPtr, ns, true); return ERRNO.SUCCESS;
        },
        fd_fdstat_get(fd, ptr) {
          const dv = self.dv(); const f = self.fds.get(fd);
          let type = FILETYPE.CHAR;
          if (fd > 2) { if (!f) return ERRNO.BADF; type = f.dir !== undefined ? FILETYPE.DIRECTORY : FILETYPE.REGULAR; }
          dv.setUint8(ptr, type); dv.setUint16(ptr + 2, 0, true);
          dv.setBigUint64(ptr + 8, 0xFFFFFFFFFFFFFFFFn, true); dv.setBigUint64(ptr + 16, 0xFFFFFFFFFFFFFFFFn, true);
          return ERRNO.SUCCESS;
        },
        fd_fdstat_set_flags() { return ERRNO.SUCCESS; },
        fd_prestat_get(fd, ptr) {
          const f = self.fds.get(fd);
          if (!f || !f.preopen) return ERRNO.BADF;
          const dv = self.dv(); dv.setUint8(ptr, 0); dv.setUint32(ptr + 4, enc.encode(f.preopen).length, true);
          return ERRNO.SUCCESS;
        },
        fd_prestat_dir_name(fd, ptr, len) {
          const f = self.fds.get(fd);
          if (!f || !f.preopen) return ERRNO.BADF;
          self.u8().set(enc.encode(f.preopen).subarray(0, len), ptr); return ERRNO.SUCCESS;
        },
        fd_read(fd, iovs, iovsLen, nreadPtr) {
          const f = self.fds.get(fd); const dv = self.dv();
          if (fd === 0) { dv.setUint32(nreadPtr, 0, true); return ERRNO.SUCCESS; }
          if (!f || !(f instanceof OpenFile)) return ERRNO.BADF;
          const data = f.data || new Uint8Array(0); let n = 0; const mem = self.u8();
          for (let i = 0; i < iovsLen; i++) {
            const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
            const chunk = data.subarray(f.pos, f.pos + l);
            mem.set(chunk, p); f.pos += chunk.length; n += chunk.length;
            if (chunk.length < l) break;
          }
          dv.setUint32(nreadPtr, n, true); return ERRNO.SUCCESS;
        },
        fd_write(fd, iovs, iovsLen, nwPtr) {
          const dv = self.dv(); const mem = self.u8(); let n = 0;
          const pieces = [];
          for (let i = 0; i < iovsLen; i++) {
            const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
            pieces.push(mem.slice(p, p + l)); n += l;
          }
          if (fd === 1 || fd === 2) { for (const pc of pieces) self.flushOut(fd, dec.decode(pc)); }
          else {
            const f = self.fds.get(fd);
            if (!f || !(f instanceof OpenFile)) return ERRNO.BADF;
            let data = f.data || new Uint8Array(0);
            if (f.append) f.pos = data.length;
            const end = f.pos + n;
            if (end > data.length) {
              if (end <= data.buffer.byteLength - data.byteOffset) {
                data = new Uint8Array(data.buffer, data.byteOffset, end);   // grow in place within capacity
              } else {
                const cap = Math.max(end, Math.min(data.length * 2, end + (1 << 22)), 4096);
                const nd = new Uint8Array(cap); nd.set(data); data = nd.subarray(0, end);
              }
            }
            for (const pc of pieces) { data.set(pc, f.pos); f.pos += pc.length; }
            f.data = data;
          }
          dv.setUint32(nwPtr, n, true); return ERRNO.SUCCESS;
        },
        fd_seek(fd, offset, whence, outPtr) {
          const f = self.fds.get(fd);
          if (!f || !(f instanceof OpenFile)) return ERRNO.BADF;
          const len = (f.data || new Uint8Array(0)).length; const off = Number(offset);
          let np = whence === 0 ? off : whence === 1 ? f.pos + off : len + off;
          if (np < 0) return ERRNO.INVAL;
          f.pos = np; self.dv().setBigUint64(outPtr, BigInt(np), true); return ERRNO.SUCCESS;
        },
        path_filestat_get(dirfd, flags, pathPtr, pathLen, bufPtr) {
          const p = self.resolve(dirfd, pathPtr, pathLen);
          if (p === null) return ERRNO.BADF;
          const dv = self.dv();
          for (let i = 0; i < 64; i += 8) dv.setBigUint64(bufPtr + i, 0n, true);
          if (self.fs.dirs.has(p)) { dv.setUint8(bufPtr + 16, FILETYPE.DIRECTORY); return ERRNO.SUCCESS; }
          const d = self.fs.files.get(p);
          if (!d) return ERRNO.NOENT;
          dv.setUint8(bufPtr + 16, FILETYPE.REGULAR); dv.setBigUint64(bufPtr + 24, 1n, true);
          dv.setBigUint64(bufPtr + 32, BigInt(d.length), true);
          return ERRNO.SUCCESS;
        },
        path_open(dirfd, dirflags, pathPtr, pathLen, oflags, rightsBase, rightsInh, fdflags, fdPtr) {
          const p = self.resolve(dirfd, pathPtr, pathLen);
          if (p === null) return ERRNO.BADF;
          const CREAT = 1, DIRECTORY = 2, EXCL = 4, TRUNC = 8;
          if (self.fs.dirs.has(p)) {
            const fd = self.nextFd++; self.fds.set(fd, { dir: p }); self.dv().setUint32(fdPtr, fd, true); return ERRNO.SUCCESS;
          }
          if (oflags & DIRECTORY) return ERRNO.NOTDIR;
          const exists = self.fs.files.has(p);
          if (!exists && !(oflags & CREAT)) return ERRNO.NOENT;
          if (exists && (oflags & EXCL)) return ERRNO.EXIST;
          if (!exists || (oflags & TRUNC)) self.fs.files.set(p, new Uint8Array(0));
          const fd = self.nextFd++;
          self.fds.set(fd, new OpenFile(self.fs, p, !!(fdflags & 1)));
          self.dv().setUint32(fdPtr, fd, true); return ERRNO.SUCCESS;
        },
        path_unlink_file(dirfd, pathPtr, pathLen) {
          const p = self.resolve(dirfd, pathPtr, pathLen);
          if (!self.fs.files.has(p)) return ERRNO.NOENT;
          self.fs.files.delete(p); return ERRNO.SUCCESS;
        },
        poll_oneoff(inPtr, outPtr, nsubs, neventsPtr) { self.dv().setUint32(neventsPtr, 0, true); return ERRNO.SUCCESS; },
        proc_exit(code) { throw new Error('proc_exit(' + code + ')'); },
      };
      return W;
    }
  }

  const api = { MemFS, MemWASI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MemWASI = api;
})(typeof self !== 'undefined' ? self : this);
