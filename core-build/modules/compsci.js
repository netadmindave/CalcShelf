// The Computer Science module: IPv4/IPv6 subnetting (tools in app/www/js/netcalc.js), bits and bytes, storage and
// data-rate conversions, transfer times, number bases and bitwise operations, reference tables, and formulas for
// the Variable Solver.
module.exports = () => {
  const B = ['bit', 'B', 'kbit', 'kB', 'KiB', 'Mbit', 'MB', 'MiB', 'Gbit', 'GB', 'GiB', 'Tbit', 'TB', 'TiB', 'PB', 'PiB'];
  const RATE = ['bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s', 'Tbit/s', 'B/s', 'kB/s', 'KiB/s', 'MB/s', 'MiB/s', 'GB/s', 'GiB/s'];
  const n2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const mask = (p) => (p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const cidr = [];
  for (let p = 32; p >= 0; p--) {
    const size = 2 ** (32 - p), hosts = p === 32 ? 1 : p === 31 ? 2 : size - 2;
    const cls = p >= 24 ? (2 ** (p - 24)) + ' per /24' : p >= 16 ? (2 ** (24 - p)) + ' × /24' : p >= 8 ? (2 ** (16 - p)) + ' × /16' : (2 ** (8 - p)) + ' × /8';
    cidr.push(['/' + p, n2ip(mask(p)), n2ip(~mask(p) >>> 0), fmt(size), fmt(hosts) + (p >= 31 ? (p === 31 ? ' (point-to-point)' : ' (host)') : ''), p === 24 ? '1 × /24' : cls]);
  }
  const NAMES = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT (tab)', 'LF (line feed)', 'VT', 'FF', 'CR (return)', 'SO', 'SI', 'DLE', 'DC1 (XON)', 'DC2', 'DC3 (XOFF)', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
  const ascii = [];
  for (let i = 0; i < 128; i++) ascii.push([String(i), i.toString(16).toUpperCase().padStart(2, '0'), i.toString(8).padStart(3, '0'), i.toString(2).padStart(8, '0'), i < 32 ? NAMES[i] : i === 32 ? 'space' : i === 127 ? 'DEL' : String.fromCharCode(i)]);
  const pow2 = [];
  const IEC = { 10: 'Ki (kibi)', 20: 'Mi (mebi)', 30: 'Gi (gibi)', 40: 'Ti (tebi)', 50: 'Pi (pebi)', 60: 'Ei (exbi)' };
  for (let n = 0; n <= 64; n++) pow2.push([String(n), (2n ** BigInt(n)).toString(), '0x' + (2n ** BigInt(n)).toString(16).toUpperCase(), IEC[n] || (n === 8 ? 'one byte of values' : n === 16 ? 'uint16 range' : n === 32 ? 'uint32 / IPv4 space' : n === 64 ? 'uint64 range' : '')]);
  const ports = [
    ['20, 21', 'TCP', 'FTP (data, control)'], ['22', 'TCP', 'SSH, SFTP, SCP'], ['23', 'TCP', 'Telnet'], ['25', 'TCP', 'SMTP'], ['53', 'TCP/UDP', 'DNS'], ['67, 68', 'UDP', 'DHCP (server, client)'],
    ['69', 'UDP', 'TFTP'], ['80', 'TCP', 'HTTP'], ['88', 'TCP/UDP', 'Kerberos'], ['110', 'TCP', 'POP3'], ['123', 'UDP', 'NTP'], ['137–139', 'TCP/UDP', 'NetBIOS'], ['143', 'TCP', 'IMAP'],
    ['161, 162', 'UDP', 'SNMP, SNMP traps'], ['179', 'TCP', 'BGP'], ['389', 'TCP/UDP', 'LDAP'], ['443', 'TCP/UDP', 'HTTPS (UDP: HTTP/3, QUIC)'], ['445', 'TCP', 'SMB'], ['465', 'TCP', 'SMTP over TLS'],
    ['500, 4500', 'UDP', 'IPsec IKE, NAT-T'], ['514', 'UDP', 'Syslog'], ['520', 'UDP', 'RIP'], ['546, 547', 'UDP', 'DHCPv6'], ['587', 'TCP', 'SMTP submission'], ['636', 'TCP', 'LDAPS'], ['853', 'TCP', 'DNS over TLS'],
    ['873', 'TCP', 'rsync'], ['993', 'TCP', 'IMAPS'], ['995', 'TCP', 'POP3S'], ['1194', 'UDP', 'OpenVPN'], ['1433', 'TCP', 'Microsoft SQL Server'], ['1521', 'TCP', 'Oracle database'], ['1883, 8883', 'TCP', 'MQTT, MQTT over TLS'],
    ['1900', 'UDP', 'SSDP (UPnP)'], ['2049', 'TCP/UDP', 'NFS'], ['3128', 'TCP', 'Squid proxy'], ['3306', 'TCP', 'MySQL, MariaDB'], ['3389', 'TCP/UDP', 'RDP'], ['5060, 5061', 'TCP/UDP', 'SIP, SIP over TLS'],
    ['5353', 'UDP', 'mDNS'], ['5432', 'TCP', 'PostgreSQL'], ['5900', 'TCP', 'VNC'], ['6379', 'TCP', 'Redis'], ['6443', 'TCP', 'Kubernetes API'], ['8006', 'TCP', 'Proxmox VE web'], ['8080, 8443', 'TCP', 'HTTP, HTTPS alternates'],
    ['8123', 'TCP', 'Home Assistant'], ['9100', 'TCP', 'Printing (JetDirect), Prometheus node exporter'], ['27017', 'TCP', 'MongoDB'], ['51820', 'UDP', 'WireGuard'],
  ];
  const ranges = [
    ['0.0.0.0/8', '“This network”', 'RFC 791'], ['10.0.0.0/8', 'Private', 'RFC 1918'], ['100.64.0.0/10', 'Carrier-grade NAT', 'RFC 6598'], ['127.0.0.0/8', 'Loopback', 'RFC 1122'],
    ['169.254.0.0/16', 'Link-local (APIPA)', 'RFC 3927'], ['172.16.0.0/12', 'Private (172.16–172.31)', 'RFC 1918'], ['192.0.2.0/24', 'Documentation TEST-NET-1', 'RFC 5737'], ['192.168.0.0/16', 'Private', 'RFC 1918'],
    ['198.18.0.0/15', 'Benchmarking', 'RFC 2544'], ['198.51.100.0/24', 'Documentation TEST-NET-2', 'RFC 5737'], ['203.0.113.0/24', 'Documentation TEST-NET-3', 'RFC 5737'], ['224.0.0.0/4', 'Multicast (class D)', 'RFC 5771'],
    ['240.0.0.0/4', 'Reserved (class E)', 'RFC 1112'], ['255.255.255.255/32', 'Limited broadcast', 'RFC 919'],
    ['::1/128', 'IPv6 loopback', 'RFC 4291'], ['fe80::/10', 'IPv6 link-local', 'RFC 4291'], ['fc00::/7', 'IPv6 unique local', 'RFC 4193'], ['ff00::/8', 'IPv6 multicast', 'RFC 4291'],
    ['2000::/3', 'IPv6 global unicast', 'RFC 4291'], ['2001:db8::/32', 'IPv6 documentation', 'RFC 3849'], ['::ffff:0:0/96', 'IPv4-mapped IPv6', 'RFC 4291'],
  ];
  const prefixes = [
    ['kilo', 'k', '10³', '1 000', 'kibi', 'Ki', '2¹⁰', '1 024', '2.4 %'], ['mega', 'M', '10⁶', '1 000 000', 'mebi', 'Mi', '2²⁰', '1 048 576', '4.9 %'],
    ['giga', 'G', '10⁹', '1 000 000 000', 'gibi', 'Gi', '2³⁰', '1 073 741 824', '7.4 %'], ['tera', 'T', '10¹²', '10¹²', 'tebi', 'Ti', '2⁴⁰', '1 099 511 627 776', '10.0 %'],
    ['peta', 'P', '10¹⁵', '10¹⁵', 'pebi', 'Pi', '2⁵⁰', '1.126 × 10¹⁵', '12.6 %'], ['exa', 'E', '10¹⁸', '10¹⁸', 'exbi', 'Ei', '2⁶⁰', '1.153 × 10¹⁸', '15.3 %'],
  ];
  const ints = [
    ['int8 (signed char)', '8', '−128', '127'], ['uint8 (byte)', '8', '0', '255'], ['int16 (short)', '16', '−32 768', '32 767'], ['uint16', '16', '0', '65 535'],
    ['int32 (int)', '32', '−2 147 483 648', '2 147 483 647'], ['uint32', '32', '0', '4 294 967 295'], ['int64 (long long)', '64', '−9 223 372 036 854 775 808', '9 223 372 036 854 775 807'],
    ['uint64', '64', '0', '18 446 744 073 709 551 615'], ['int128', '128', '−2¹²⁷', '2¹²⁷ − 1'],
  ];
  const floats = [
    ['half (binary16)', '16', '5', '10', '65 504', '6.10 × 10⁻⁵', '9.77 × 10⁻⁴', '3.3'], ['bfloat16', '16', '8', '7', '3.39 × 10³⁸', '1.18 × 10⁻³⁸', '7.81 × 10⁻³', '2.4'],
    ['single (binary32)', '32', '8', '23', '3.40 × 10³⁸', '1.18 × 10⁻³⁸', '1.19 × 10⁻⁷', '7.2'], ['double (binary64)', '64', '11', '52', '1.80 × 10³⁰⁸', '2.23 × 10⁻³⁰⁸', '2.22 × 10⁻¹⁶', '16.0'],
    ['quad (binary128)', '128', '15', '112', '1.19 × 10⁴⁹³²', '3.36 × 10⁻⁴⁹³²', '1.93 × 10⁻³⁴', '34.0'],
  ];
  const bigO = [
    ['Array: index', 'O(1)', 'O(1)', ''], ['Array: search', 'O(n)', 'O(n)', 'O(log n) if sorted (binary search)'], ['Array: insert or delete', 'O(n)', 'O(n)', 'O(1) amortized append'],
    ['Linked list: insert or delete at a node', 'O(1)', 'O(1)', 'finding the node is O(n)'], ['Hash table: lookup, insert, delete', 'O(1)', 'O(n)', 'average vs worst case'],
    ['Binary search tree (balanced): search, insert, delete', 'O(log n)', 'O(log n)', 'unbalanced worst case O(n)'], ['Binary heap: insert, pop min', 'O(log n)', 'O(log n)', 'peek O(1)'],
    ['Quicksort', 'O(n log n)', 'O(n²)', 'in place, not stable'], ['Mergesort', 'O(n log n)', 'O(n log n)', 'stable, O(n) extra space'], ['Heapsort', 'O(n log n)', 'O(n log n)', 'in place, not stable'],
    ['Insertion sort', 'O(n²)', 'O(n²)', 'O(n) when nearly sorted'], ['Counting or radix sort', 'O(n + k)', 'O(n + k)', 'k = key range or digits'], ['Binary search', 'O(log n)', 'O(log n)', 'sorted input'],
    ['Breadth- or depth-first search', 'O(V + E)', 'O(V + E)', ''], ['Dijkstra (binary heap)', 'O((V + E) log V)', 'O((V + E) log V)', 'non-negative weights'], ['Floyd–Warshall', 'O(V³)', 'O(V³)', 'all pairs'],
    ['Matrix multiplication (naive)', 'O(n³)', 'O(n³)', ''], ['Fast Fourier transform', 'O(n log n)', 'O(n log n)', ''],
  ];
  const http = [
    ['200', 'OK'], ['201', 'Created'], ['204', 'No Content'], ['301', 'Moved Permanently'], ['302', 'Found (temporary redirect)'], ['304', 'Not Modified'], ['307', 'Temporary Redirect'], ['308', 'Permanent Redirect'],
    ['400', 'Bad Request'], ['401', 'Unauthorized (not authenticated)'], ['403', 'Forbidden'], ['404', 'Not Found'], ['405', 'Method Not Allowed'], ['408', 'Request Timeout'], ['409', 'Conflict'], ['413', 'Payload Too Large'],
    ['418', 'I’m a teapot'], ['429', 'Too Many Requests'], ['500', 'Internal Server Error'], ['502', 'Bad Gateway'], ['503', 'Service Unavailable'], ['504', 'Gateway Timeout'],
  ];
  const out = (label, expr, unit, units, more) => Object.assign({ label, expr, unit, digits: 12 }, units ? { units } : {}, more || {});
  const int = (label, expr) => ({ label, expr, unit: '', format: 'exact' });
  return {
    format: 'calcshelf-module', formatVersion: 1,
    id: 'compsci', name: 'Computer Science', tab: 'CompSci', version: '1.0.0', icon: 'chip',
    author: 'CalcShelf', license: 'GPL-3.0-or-later', homepage: 'https://github.com/netadmindave/CalcShelf/tree/main/modules',
    description: 'IPv4 and IPv6 subnetting (CIDR, VLSM, summaries), bits and bytes, storage sizes in decimal (kB, MB, GB) and binary (KiB, MiB, GiB) units, data rates and transfer times, number bases and bitwise operations, and tables: CIDR masks, special address ranges, ports, ASCII, powers of 2, integer and floating-point formats, algorithm complexity and HTTP status codes.',
    variables: [
      { id: 'csS', symbol: 'S', name: 'Data size', description: 'Amount of data.', unit: 'MB', also: 'file size' },
      { id: 'csR', symbol: 'R', name: 'Data rate', description: 'Line rate or throughput.', unit: 'Mbit/s', also: 'bandwidth, throughput' },
      { id: 'cst', symbol: 't', name: 'Transfer time', description: 'Time to move the data.', unit: 's' },
      { id: 'cseff', symbol: '\\eta', name: 'Link efficiency', description: 'Fraction of the line rate the data gets after protocol overhead (about 0.94 for TCP over Ethernet).', unit: '' },
      { id: 'csRTT', symbol: '\\mathrm{RTT}', name: 'Round-trip time', description: 'Time for a packet to go and its reply to come back.', unit: 'ms', also: 'ping' },
      { id: 'csBDP', symbol: '\\mathrm{BDP}', name: 'Bandwidth–delay product', description: 'Data in flight on a link: the TCP window needed to fill it.', unit: 'KiB' },
      { id: 'csp', symbol: 'p', name: 'Parallel fraction', description: 'Fraction of the work that can run in parallel (Amdahl).', unit: '' },
      { id: 'csN', symbol: 'N', name: 'Processors', description: 'Number of processors or cores.', unit: '' },
      { id: 'csSp', symbol: 'S_p', name: 'Speedup', description: 'Times faster than one processor.', unit: '' },
    ],
    sections: [
      { title: 'Subnetting', items: [
        { type: 'tool', tool: 'net.ipv4', title: 'IPv4 subnet calculator', note: 'Network, broadcast, mask, wildcard, host range and the bits; split into subnets; VLSM; summarize.', tags: 'cidr netmask wildcard broadcast hosts vlsm supernet summary route' },
        { type: 'tool', tool: 'net.ipv6', title: 'IPv6 subnet calculator', note: 'Expand and compress, the network and range of a prefix, and smaller prefixes inside it.', tags: 'ipv6 prefix expand compress' },
        { type: 'table', title: 'CIDR prefixes and masks', columns: ['Prefix', 'Netmask', 'Wildcard', 'Addresses', 'Usable hosts', 'Size'], rows: cidr, note: 'Usable hosts = addresses − 2 (network and broadcast), except /31 (point-to-point) and /32.' },
        { type: 'table', title: 'Special address ranges', columns: ['Range', 'Use', 'Defined in'], rows: ranges },
      ] },
      { title: 'Bits & bytes', items: [
        { type: 'calc', title: 'Storage size', tex: '1\\,\\mathrm{B}=8\\,\\mathrm{bit},\\ 1\\,\\mathrm{KiB}=1024\\,\\mathrm{B}',
          note: 'kB, MB, GB are powers of 1000 (drive makers, networking); KiB, MiB, GiB are powers of 1024 (memory, and the sizes most operating systems show).',
          inputs: [{ id: 'x', label: 'Size', unit: 'B', default: '1', units: B }],
          outputs: [out('Bits', 'x*8', 'bit'), out('Bytes', 'x', 'B'), out('Kilobytes (1000 B)', 'x/1000', 'kB'), out('Kibibytes (1024 B)', 'x/1024', 'KiB'),
            out('Megabytes', 'x/10^6', 'MB'), out('Mebibytes', 'x/2^20', 'MiB'), out('Gigabytes', 'x/10^9', 'GB'), out('Gibibytes', 'x/2^30', 'GiB'),
            out('Terabytes', 'x/10^12', 'TB'), out('Tebibytes', 'x/2^40', 'TiB'), out('Petabytes', 'x/10^15', 'PB'), out('Pebibytes', 'x/2^50', 'PiB')] },
        { type: 'calc', title: 'Drive size as the computer shows it', tex: '1\\,\\mathrm{TB}=0.909\\,\\mathrm{TiB}', note: 'A drive sold as 2 TB holds 2 × 10¹² bytes; Windows shows that as 1.82 “TB” (really TiB).',
          inputs: [{ id: 'x', label: 'Advertised size', unit: 'GB', default: '2000', units: ['GB', 'TB', 'MB'] }],
          outputs: [out('Shown in binary units', 'x*10^9/2^30', 'GiB', ['GiB', 'TiB', 'MiB'], { digits: 6 }), out('Difference', '(1-10^9/2^30)*100', '%', null, { digits: 6 })] },
        { type: 'calc', title: 'Bits and bytes', inputs: [{ id: 'n', label: 'Bits', default: '64' }],
          outputs: [out('Bytes', 'n/8', ''), out('Nibbles (4 bits)', 'n/4', ''), out('Hex digits', 'ceil(n/4)', ''), int('Distinct values', '2^n')] },
        { type: 'calc', title: 'Bits needed for N values', tex: 'b=\\lceil\\log_2N\\rceil', inputs: [{ id: 'N', label: 'Number of values', default: '1000' }],
          outputs: [int('Bits', 'ceil(log(N)/log(2))'), int('Bytes', 'ceil(ceil(log(N)/log(2))/8)')] },
        { type: 'table', title: 'Decimal (SI) and binary (IEC) prefixes', columns: ['SI', 'Symbol', 'Power', 'Value', 'IEC', 'Symbol', 'Power', 'Value', 'Binary larger by'], rows: prefixes },
        { type: 'table', title: 'Powers of 2', columns: ['n', '2ⁿ', 'Hex', 'Note'], rows: pow2, near: [{ col: 1, label: 'value' }] },
      ] },
      { title: 'Data rates', items: [
        { type: 'calc', title: 'Data rate', note: 'Network speeds are in bits per second (Mbit/s, Gbit/s); download speeds are often shown in bytes per second (MB/s).',
          inputs: [{ id: 'r', label: 'Rate', unit: 'bit/s', default: '1000000000', units: RATE }],
          outputs: [out('Megabits per second', 'r/10^6', 'Mbit/s'), out('Gigabits per second', 'r/10^9', 'Gbit/s'), out('Megabytes per second', 'r/8/10^6', 'MB/s'), out('Mebibytes per second', 'r/8/2^20', 'MiB/s', null, { digits: 6 }), out('Gigabytes per hour', 'r/8*3600/10^9', 'GB/h')] },
        { type: 'calc', title: 'Transfer time', tex: 't=\\frac{S}{\\eta R}', note: 'η is the fraction of the line rate the data gets: about 0.94 for TCP over Ethernet, less over Wi-Fi.',
          inputs: [{ id: 'S', label: 'Data size', unit: 'B', default: '4.7e9', units: B }, { id: 'R', label: 'Line rate', unit: 'bit/s', default: '100e6', units: RATE }, { id: 'eta', label: 'Efficiency η', default: '0.94' }],
          outputs: [out('Time', '8*S/(eta*R)', 's', ['s', 'min', 'h', 'd'], { digits: 6 }), out('Throughput', 'eta*R/8/10^6', 'MB/s', ['MiB/s', 'kB/s', 'Mbit/s'], { digits: 6 })] },
        { type: 'calc', title: 'Bandwidth–delay product (TCP window)', tex: '\\mathrm{BDP}=R\\cdot\\mathrm{RTT}',
          inputs: [{ id: 'R', label: 'Line rate', unit: 'bit/s', default: '1e9', units: RATE }, { id: 'rtt', label: 'Round-trip time', unit: 's', default: '0.05', units: ['s', 'ms', 'µs'] }],
          outputs: [out('Data in flight', 'R*rtt/8', 'B', ['B', 'KiB', 'MiB', 'kB', 'MB']), out('Packets of 1500 B', 'R*rtt/8/1500', '')] },
      ] },
      { title: 'Numbers', items: [
        { type: 'tool', tool: 'convert.base', title: 'Number base converter', note: 'Decimal, hexadecimal, binary and octal, any size.' },
        { type: 'calc', title: 'Bitwise operations', note: 'Whole numbers. NOT is shown for the word size you pick.',
          inputs: [{ id: 'a', label: 'a', default: '12' }, { id: 'b', label: 'b', default: '10' }, { id: 'w', label: 'Word size (bits)', options: [{ label: '8', value: '8' }, { label: '16', value: '16' }, { label: '32', value: '32' }, { label: '64', value: '64' }], default: 2 }],
          outputs: [int('a AND b', 'bitand(a,b)'), int('a OR b', 'bitor(a,b)'), int('a XOR b', 'bitxor(a,b)'), int('NOT a', '2^w-1-a'), int('a << 1', 'irem(a*2,2^w)'), int('a >> 1', 'iquo(a,2)')] },
        { type: 'calc', title: 'Two’s complement', note: 'A signed value and its bit pattern as an unsigned number, and back.',
          inputs: [{ id: 'v', label: 'Signed value', default: '-42' }, { id: 'w', label: 'Bits', options: [{ label: '8', value: '8' }, { label: '16', value: '16' }, { label: '32', value: '32' }, { label: '64', value: '64' }], default: 0 }],
          outputs: [int('As unsigned', 'irem(v+2^w,2^w)'), int('Range', '[-2^(w-1),2^(w-1)-1]')] },
        { type: 'table', title: 'Integer types', columns: ['Type', 'Bits', 'Minimum', 'Maximum'], rows: ints },
        { type: 'table', title: 'IEEE 754 floating point', columns: ['Format', 'Bits', 'Exponent bits', 'Fraction bits', 'Largest', 'Smallest normal', 'Machine ε', 'Decimal digits'], rows: floats },
        { type: 'table', title: 'ASCII', columns: ['Dec', 'Hex', 'Oct', 'Binary', 'Character'], rows: ascii, near: [{ col: 0, label: 'code' }] },
      ] },
      { title: 'Reference', items: [
        { type: 'table', title: 'Common ports', columns: ['Port', 'Protocol', 'Service'], rows: ports },
        { type: 'table', title: 'Algorithm and data-structure complexity', columns: ['Operation', 'Average', 'Worst', 'Note'], rows: bigO },
        { type: 'table', title: 'HTTP status codes', columns: ['Code', 'Meaning'], rows: http },
      ] },
      { title: 'Formulas', items: [
        { type: 'formula', title: 'Transfer time', tex: 't=\\frac{S}{\\eta R}', eq: 't=S/(eta*R)', vars: [['t', 'transfer time', 's', '', 'cst'], ['S', 'data size', 'bit', '', 'csS'], ['eta', 'link efficiency', '', '1', 'cseff'], ['R', 'data rate', 'bit/s', '', 'csR']] },
        { type: 'formula', title: 'Bandwidth–delay product', tex: '\\mathrm{BDP}=R\\cdot\\mathrm{RTT}', eq: 'BDP=R*RTT', vars: [['BDP', 'bandwidth–delay product', 'bit', '', 'csBDP'], ['R', 'data rate', 'bit/s', '', 'csR'], ['RTT', 'round-trip time', 's', '', 'csRTT']] },
        { type: 'formula', title: 'Amdahl’s law', tex: 'S_p=\\frac{1}{(1-p)+p/N}', eq: 'Sp=1/((1-p)+p/N)', vars: [['Sp', 'speedup', '', '', 'csSp'], ['p', 'parallel fraction', '', '', 'csp'], ['N', 'processors', '', '', 'csN']] },
        { type: 'formula', title: 'CPU time', tex: 't=\\frac{N_I\\cdot\\mathrm{CPI}}{f}', eq: 't=NI*CPI/f', vars: [['t', 'CPU time', 's'], ['NI', 'instructions executed', ''], ['CPI', 'cycles per instruction', ''], ['f', 'clock frequency', 'Hz']] },
        { type: 'formula', title: 'Little’s law', tex: 'L=\\lambda W', eq: 'L=lam*W', vars: [['L', 'items in the system', ''], ['lam', 'arrival rate', '1/s'], ['W', 'time each spends in the system', 's']] },
        { type: 'formula', title: 'Availability', tex: 'A=\\frac{\\mathrm{MTBF}}{\\mathrm{MTBF}+\\mathrm{MTTR}}', eq: 'A=MTBF/(MTBF+MTTR)', vars: [['A', 'availability', ''], ['MTBF', 'mean time between failures', 'h'], ['MTTR', 'mean time to repair', 'h']] },
        { type: 'formula', title: 'Password entropy', tex: 'H=L\\log_2N', eq: 'H=L*log(N)/log(2)', vars: [['H', 'entropy', 'bit'], ['L', 'length (characters)', ''], ['N', 'size of the character set', '']], note: '26 lower case, 52 mixed case, 62 with digits, 95 printable ASCII. Random passwords only.' },
        { type: 'formula', title: 'Birthday bound (hash collisions)', tex: 'P\\approx1-e^{-n^2/(2m)}', eq: 'P=1-exp(-n^2/(2*m))', vars: [['P', 'probability of a collision', ''], ['n', 'items hashed', ''], ['m', 'possible hash values (2^bits)', '']] },
        { type: 'formula', title: 'Nyquist bit rate (noiseless channel)', tex: 'C=2B\\log_2M', eq: 'C=2*B*log(M)/log(2)', vars: [['C', 'bit rate', 'bit/s'], ['B', 'bandwidth', 'Hz'], ['M', 'signal levels', '']] },
      ] },
    ],
  };
};
