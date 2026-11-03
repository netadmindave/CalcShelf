/*
 * quantities.js — the variable dictionary of the Variable Solver. Every formula variable (in the library and in
 * every module) is matched to a quantity here, so that a value you enter for one formula feeds every other formula
 * that uses the same quantity. Variables that match nothing are linked only to variables with the same name, unit
 * and description.
 *
 * Q(id, symbol (LaTeX), name, description, SI unit, { also: other names, value: a constant's value })
 * R(id, names, { d: description must match, x: description must not match, w: "source|section|title" must match,
 *   xw: … must not match })
 * input: a quantity you give, never one to calculate (doping). context: a condition such as the temperature; a formula
 * whose only known values are context ones isn't used, so entering T alone doesn't fill in every T-dependent formula.
 * The rules are tried in order; the first that matches (with the same physical dimension) wins.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function () {
  const Q = {}, RULES = [];
  const q = (id, sym, name, desc, unit, o = {}) => { Q[id] = { id, sym, name, desc, unit, also: o.also || '', value: o.value, input: !!o.input, context: !!o.context }; };
  const r = (id, names, o = {}) => RULES.push({ id, n: new Set(names.split(' ')), d: o.d, x: o.x, w: o.w, xw: o.xw });
  const OPT = /^(optics|lib\|Optics|lib\|Modern)/;          // optics module and the library's optics formulas
  const SEMI = /^optics\|(Semiconductor|Junctions)/;        // the semiconductor sections of the Optics module

  /* ---------------------------------------------------------------- physical constants (known unless you enter them) */
  q('c', 'c', 'Speed of light', 'Speed of light in vacuum (exact).', 'm/s', { value: 299792458 });
  q('h', 'h', 'Planck constant', 'Planck constant (exact). Photon energy E = hν.', 'J*s', { value: 6.62607015e-34 });
  q('hbar', '\\hbar', 'Reduced Planck constant', 'ħ = h/2π.', 'J*s', { value: 1.054571817e-34 });
  q('kB', 'k_B', 'Boltzmann constant', 'Boltzmann constant (exact). Thermal energy k_BT ≈ 25.85 meV at 300 K.', 'J/K', { value: 1.380649e-23, also: 'k' });
  q('qe', 'e', 'Elementary charge', 'Charge of the proton (exact); the electron has −e. Written q in semiconductor books.', 'C', { value: 1.602176634e-19, also: 'q' });
  q('eps0', '\\varepsilon_0', 'Vacuum permittivity', 'Electric constant ε₀.', 'F/m', { value: 8.8541878128e-12 });
  q('mu0', '\\mu_0', 'Vacuum permeability', 'Magnetic constant μ₀.', 'N/A^2', { value: 1.25663706212e-6 });
  q('me', 'm_0', 'Electron rest mass', 'Free-electron mass m₀ (also mₑ). Effective masses are given as multiples of it.', 'kg', { value: 9.1093837015e-31, also: 'mₑ' });
  q('Gc', 'G', 'Gravitational constant', 'Newtonian constant of gravitation.', 'm^3/(kg*s^2)', { value: 6.6743e-11 });
  q('g', 'g', 'Standard gravity', 'Standard acceleration of gravity.', 'm/s^2', { value: 9.80665 });
  q('sigSB', '\\sigma', 'Stefan–Boltzmann constant', 'Radiated power per area of a black body = σT⁴.', 'W/(m^2*K^4)', { value: 5.670374419e-8 });
  q('Rgas', 'R', 'Gas constant', 'Molar gas constant R = N_A k_B.', 'J/(mol*K)', { value: 8.314462618 });
  q('Rinf', 'R_\\infty', 'Rydberg constant', 'Rydberg constant for infinite nuclear mass.', '1/m', { value: 10973731.56816 });
  q('bW', 'b', 'Wien constant', 'Wien displacement constant: λ_max T = b.', 'm*K', { value: 2.897771955e-3 });
  q('eta0', '\\eta_0', 'Impedance of free space', 'η₀ = √(μ₀/ε₀) ≈ 376.73 Ω.', 'ohm', { value: 376.730313668 });
  r('c', 'c', { d: /^(c|speed of light c)$/i });
  r('h', 'h', { d: /^h$|planck/i });
  r('hbar', 'hb hbar');
  r('kB', 'kB');
  r('qe', 'q', { d: /^e$|elementary/i });
  r('eps0', 'e0 eps0');
  r('mu0', 'mu0');
  r('me', 'me m0', { d: /^m[ₑe₀0]$|electron rest mass|^mₑ$/i });
  r('Gc', 'G', { d: /^G$/ });
  r('g', 'g', { d: /gravity/i });
  r('sigSB', 'sigma', { d: /^σ$/ });
  r('Rgas', 'R', { d: /gas constant/i });
  r('Rinf', 'Rinf');
  r('bW', 'b', { d: /wien/i });
  r('eta0', 'eta0');

  /* ---------------------------------------------------------------- light */
  q('lam0', '\\lambda_0', 'Wavelength (vacuum)', 'Wavelength of the light in vacuum (what a spectrometer or laser datasheet quotes). Inside a medium of index n it is λ₀/n.', 'm', { also: 'λ, centre wavelength' });
  q('lamm', '\\lambda', 'Wavelength in the medium', 'Wavelength inside a material: λ = λ₀/n.', 'm');
  q('nu', '\\nu', 'Optical frequency', 'Frequency of the light, ν = c/λ₀.', 'Hz', { also: 'f' });
  q('omega', '\\omega', 'Angular frequency', 'ω = 2πν.', 'rad/s');
  q('k', 'k', 'Wavenumber', 'Angular wavenumber k = 2πn/λ₀ in the medium.', '1/m');
  q('Eph', 'E', 'Photon energy', 'Energy of one photon, E = hν = hc/λ₀.', 'J');
  q('dnu', '\\Delta\\nu', 'Linewidth (frequency)', 'Spectral width in frequency (FWHM unless stated).', 'Hz', { also: 'bandwidth, FWHM' });
  q('dlam', '\\Delta\\lambda', 'Linewidth (wavelength)', 'Spectral width in wavelength. Δλ = λ₀²Δν/c.', 'm', { also: 'bandwidth' });
  q('Phi', '\\Phi', 'Photon flux', 'Photons per second, Φ = P/(hν).', '1/s');
  r('lamm', 'lam', { d: /medium/i });
  r('lam0', 'lam lam0 l', { x: /acoustic|cutoff|bandgap|bragg/i, w: /^(optics\|(?!Semiconductor physics)|lib\|Optics)/ });
  r('nu', 'nu', { x: /shift|poisson|\|u\||\|v\|/i, w: OPT });
  r('nu', 'f', { d: /^(frequency|optical frequency)$/i, w: /^(optics|lib\|Optics)/ });
  r('omega', 'w', { d: /angular frequency/i });
  r('k', 'k', { d: /wavenumber/i });
  r('Eph', 'E En', { d: /^(energy|photon energy)$/i, w: /^(lib|optics)\|[^|]*\|[^|]*photon/i });
  r('dnu', 'dnu', { d: /Δν|linewidth|fwhm|spectral width|^bandwidth$/i, xw: /LED/ });
  r('dlam', 'dlam', { d: /^(Δλ|bandwidth Δλ|spectral width)$/i });
  r('Phi', 'Phi', { d: /^photons per second$/i });

  /* ---------------------------------------------------------------- materials and interfaces */
  q('n', 'n', 'Refractive index', 'Phase refractive index of the material the light is in (the lens, prism, plate, crystal or medium).', '', { also: 'phase index' });
  q('n1', 'n_1', 'Index of medium 1', 'Refractive index on the incident side, or of a fibre or waveguide core.', '', { also: 'core index, incident index' });
  q('n2', 'n_2', 'Index of medium 2', 'Refractive index on the far side, or of the cladding or substrate.', '', { also: 'cladding index, substrate index' });
  q('nair', 'n_\\text{air}', 'Index of air', 'Refractive index of air, about 1.000273 at 1550 nm and 15 °C.', '');
  q('ng', 'n_g', 'Group index', 'n_g = n − λ₀ dn/dλ₀. Sets the group velocity c/n_g and the FSR of a dispersive cavity.', '');
  q('neff', 'n_\\text{eff}', 'Effective index', 'Effective index of a guided mode, β = 2πn_eff/λ₀.', '');
  q('n2nl', 'n_2', 'Nonlinear index', 'Kerr coefficient: n = n₀ + n₂I.', 'm^2/W');
  q('dndT', '\\frac{dn}{dT}', 'Thermo-optic coefficient', 'Change of index with temperature.', '1/K');
  q('dndl', '\\frac{dn}{d\\lambda_0}', 'Index slope', 'Change of index with vacuum wavelength.', '1/m');
  q('R', 'R', 'Reflectance', 'Fraction of the power reflected at a surface (0 to 1).', '', { also: 'reflectivity' });
  q('Tr', 'T', 'Transmittance', 'Fraction of the power transmitted (0 to 1).', '', { also: 'transmission' });
  q('thi', '\\theta_i', 'Angle of incidence', 'Angle from the surface normal, in the first medium.', 'rad', { also: 'θ₁' });
  q('tht', '\\theta_t', 'Angle of refraction', 'Angle from the surface normal, in the second medium.', 'rad', { also: 'θ₂' });
  q('alpha', '\\alpha', 'Absorption coefficient', 'Intensity absorption (attenuation) coefficient: I = I₀e^{−αz}.', '1/m');
  q('alphadB', '\\alpha_\\text{dB}', 'Attenuation (dB/km)', 'Fibre or material loss in decibels per kilometre.', 'dB/km');
  q('ext', '\\kappa', 'Extinction coefficient', 'Imaginary part of the complex index n + iκ; α = 4πκ/λ₀.', '');
  q('Vd', 'V_d', 'Abbe number', 'V_d = (n_d − 1)/(n_F − n_C): low means more dispersive.', '');
  r('nair', 'n', { d: /index of air/i });
  r('n', 'n n0', { d: /^(index|medium index|phase index|lens index|prism index|plate index.*|layer index|index n\(θ\)|index \(group.*|linear index|semiconductor index.*)$/i });
  r('n1', 'n1', { d: /core|denser|incident|^index 1$|before the surface|^n₁$/i });
  r('n2', 'n2', { d: /cladding|rarer|substrate|^index 2$|after the surface|^n₂$/i, x: /nonlinear/i });
  r('n2nl', 'n2', { d: /nonlinear/i });
  r('ng', 'ng', { d: /group index/i });
  r('neff', 'neff');
  r('dndT', 'dndT');
  r('dndl', 'dndl');
  r('R', 'R Rp Rs', { d: /^(reflectance|reflectance \(0 absorbing.*|surface reflectance)$/i });
  r('Tr', 'T', { d: /^(transmission|transmission \(normal incidence\))$/i });
  r('thi', 'ti t1 th', { d: /incidence/i });
  r('tht', 't2', { d: /refraction angle/i });
  r('alpha', 'a', { d: /^(absorption coefficient|attenuation coefficient|intensity absorption coefficient)$/i });
  r('alphadB', 'adb a', { d: /^(attenuation|fiber loss)$/i });
  r('ext', 'kap');
  r('Vd', 'Vd');

  /* ---------------------------------------------------------------- imaging */
  q('f', 'f', 'Focal length', 'Focal length of a lens or mirror.', 'm');
  q('so', 's_o', 'Object distance', 'Distance from the object to the lens.', 'm');
  q('si', 's_i', 'Image distance', 'Distance from the lens to the image.', 'm');
  q('Mag', 'M', 'Magnification', 'Transverse magnification of an image (negative when inverted).', '');
  q('NA', '\\text{NA}', 'Numerical aperture', 'NA = n sin θ_max. For a step-index fibre NA = √(n₁² − n₂²).', '');
  q('Fnum', 'N', 'f-number', 'f-number f/D of a lens.', '', { also: 'F/#' });
  q('Dap', 'D', 'Aperture diameter', 'Diameter of the lens, mirror or aperture.', 'm');
  r('f', 'f', { d: /^focal length$/i });
  r('so', 'so');
  r('si', 'si');
  r('Mag', 'M', { d: /^magnification$/i });
  r('NA', 'NA');
  r('Fnum', 'N', { d: /f-number/i });
  r('Dap', 'D', { d: /aperture (diameter|size)/i });

  /* ---------------------------------------------------------------- Gaussian beams and cavities */
  q('w', 'w', 'Beam radius', '1/e² intensity radius of a Gaussian beam at distance z.', 'm', { also: 'spot size' });
  q('w0', 'w_0', 'Waist radius', '1/e² radius of the beam at its waist (narrowest point).', 'm', { also: 'W₀' });
  q('zR', 'z_R', 'Rayleigh range', 'Distance from the waist where the beam area has doubled: z_R = πw₀²n/λ₀.', 'm', { also: 'z₀' });
  q('z', 'z', 'Distance from the waist', 'Propagation distance measured from the beam waist.', 'm');
  q('Rz', 'R(z)', 'Wavefront radius', 'Radius of curvature of the wavefront at z.', 'm');
  q('M2', 'M^2', 'Beam quality M²', 'Beam quality factor: 1 for a perfect Gaussian.', '');
  q('Lcav', 'L', 'Cavity length', 'Mirror spacing of a resonator or Fabry–Pérot.', 'm', { also: 'd, mirror spacing' });
  q('FSR', '\\nu_F', 'Free spectral range', 'Mode spacing of a cavity: c/(2n_gL).', 'Hz', { also: 'mode spacing' });
  q('Fin', '\\mathcal{F}', 'Finesse', 'FSR divided by the resonance linewidth.', '');
  q('Rm', 'R', 'Mirror reflectance', 'Power reflectance of each mirror (equal mirrors).', '');
  q('R1', 'R_1', 'Mirror 1 reflectance', 'Power reflectance of the first mirror or facet.', '');
  q('R2', 'R_2', 'Mirror 2 reflectance', 'Power reflectance of the second mirror or facet.', '');
  q('Qf', 'Q', 'Quality factor', 'Q = ν/Δν = 2πν × stored energy / power lost.', '');
  q('tauph', '\\tau_p', 'Photon lifetime', 'Decay time of the energy stored in a cavity.', 's');
  r('w', 'w W', { d: /beam radius|1\/e² radius/i });
  r('w0', 'w0 W0', { d: /waist radius/i });
  r('zR', 'zR z0', { d: /^(rayleigh range|rayleigh range of the mode)$/i });
  r('z', 'z', { d: /^distance from (the )?waist$/i });
  r('Rz', 'Rz');
  r('M2', 'M2', { d: /^M²$/ });
  r('Lcav', 'L d', { d: /cavity length|mirror spacing|resonator length/i });
  r('FSR', 'FSR nuF');
  r('Fin', 'Fin');
  r('Rm', 'R', { d: /^mirror reflectance$/i });
  r('R1', 'R1', { d: /reflectance R₁|^R₁$/i, w: OPT });
  r('R2', 'R2', { d: /reflectance R₂|^R₂$/i, w: OPT });
  r('Qf', 'Q Qf', { d: /^(Q|Q factor)$/i });
  r('tauph', 'tau', { d: /photon lifetime/i });

  /* ---------------------------------------------------------------- lengths, power, intensity */
  q('Ls', 'L', 'Sample length', 'Length of the sample, crystal or path the light travels through.', 'm', { also: 'path length, crystal length' });
  q('Lf', 'L_f', 'Fibre length', 'Length of a fibre link or span.', 'km');
  q('d', 'd', 'Thickness', 'Thickness of a plate, slab, film or sample.', 'm');
  q('P', 'P', 'Optical power', 'Optical power in the beam.', 'W');
  q('Pin', 'P_\\text{in}', 'Input power', 'Power going in (launched, incident).', 'W');
  q('Pout', 'P_\\text{out}', 'Output power', 'Power coming out.', 'W');
  q('I', 'I', 'Intensity', 'Optical intensity (irradiance), power per area.', 'W/m^2');
  q('I0', 'I_0', 'Incident intensity', 'Intensity (irradiance) arriving: before the sample, filter or polarizer, or on a detector or solar cell.', 'W/m^2', { also: 'irradiance' });
  q('Isat', 'I_s', 'Saturation intensity', 'Intensity that halves the gain or absorption.', 'W/m^2');
  r('Ls', 'L', { d: /^(sample length|geometric length|path length|crystal length|interaction length|length)$/i, w: /^(optics|lib\|Optics)/ });
  r('Lf', 'L', { d: /^length$/i, w: /fib|commun|link|budget|dispersion/i });
  r('d', 'd', { d: /^(thickness|physical thickness|slab thickness|sample thickness)$/i });
  r('P', 'P Po', { d: /^(power|optical power|power at normal incidence)$/i, w: /^(optics|lib\|Optics)/ });
  r('Pin', 'Pin P1', { d: /^(input power|incident power)$/i, w: /^(optics|lib\|Optics)/ });
  r('Pout', 'Pout Po P2', { d: /^output power$/i, w: /^(optics|lib\|Optics)/ });
  r('I', 'I', { d: /^(intensity|total intensity)$/i });
  r('I0', 'I0', { d: /^(incident|incident intensity|intensity entering)$/i });
  r('Isat', 'Is', { d: /saturation intensity/i });

  /* ---------------------------------------------------------------- fibres and combs */
  q('acore', 'a', 'Core radius', 'Radius of a fibre or waveguide core.', 'm');
  q('Vf', 'V', 'V number', 'Normalized frequency V = 2πa·NA/λ₀; single-mode below 2.405.', '');
  q('Ddisp', 'D', 'Dispersion parameter', 'Fibre dispersion D (ps/(nm·km) in datasheets).', 's/m^2');
  q('beta2', '\\beta_2', 'GVD', 'Group-velocity dispersion β₂ = −λ₀²D/(2πc).', 's^2/m');
  q('frep', 'f_\\text{rep}', 'Repetition rate', 'Pulse repetition rate of a mode-locked laser = comb tooth spacing.', 'Hz');
  q('fceo', 'f_\\text{ceo}', 'Offset frequency', 'Carrier-envelope offset frequency of a comb.', 'Hz');
  q('nun', '\\nu_n', 'Comb tooth frequency', 'Frequency of tooth n: ν_n = n f_rep + f_ceo.', 'Hz');
  q('ncomb', 'n', 'Tooth number', 'Integer index n of a comb tooth.', '');
  q('dfrep', '\\Delta f_\\text{rep}', 'Repetition-rate difference', 'Difference between the two combs of a dual-comb system.', 'Hz');
  q('fb', 'f_b', 'Beat frequency', 'Heterodyne beat note between two lasers or a laser and a comb tooth.', 'Hz');
  r('acore', 'a', { d: /core radius/i });
  r('Vf', 'V', { d: /^(V number|V parameter)$/i });
  r('Ddisp', 'D', { d: /^(dispersion|dispersion coefficient)$/i });
  r('beta2', 'b2');
  r('frep', 'frep');
  r('fceo', 'fceo');
  r('nun', 'nun');
  r('dfrep', 'dfrep');
  r('fb', 'fb');
  r('ncomb', 'n', { d: /^mode number$/i, w: /comb/i });

  /* ---------------------------------------------------------------- detection and noise */
  q('Resp', '\\mathcal{R}', 'Responsivity', 'Photocurrent per optical power, ℛ = ηq/(hν).', 'A/W');
  q('etaq', '\\eta', 'Quantum efficiency', 'Electrons (or photons out) per photon in (external).', '');
  q('etai', '\\eta_i', 'Internal quantum efficiency', 'Fraction of recombinations or absorbed photons that count.', '');
  q('Iph', 'I_p', 'Photocurrent', 'Current produced by the light.', 'A');
  q('Idark', 'i_d', 'Dark current', 'Detector current with no light.', 'A');
  q('Bel', 'B', 'Electrical bandwidth', 'Detection or receiver bandwidth.', 'Hz');
  q('RL', 'R_L', 'Load resistance', 'Load (transimpedance) resistance of the receiver.', 'ohm');
  q('SNR', '\\text{SNR}', 'Signal-to-noise ratio', 'Signal-to-noise ratio as a power ratio (linear).', '');
  q('NEP', '\\text{NEP}', 'Noise-equivalent power', 'Optical power that gives SNR = 1 in 1 Hz.', 'W/Hz^0.5');
  r('Resp', 'Resp Rs', { d: /responsivity/i });
  r('etaq', 'eta', { d: /^(quantum efficiency|quantum efficiency η|external quantum efficiency|efficiency η)$/i });
  r('etai', 'etai eint eta', { d: /internal (quantum )?efficiency/i });
  r('Iph', 'I IL', { d: /^(photocurrent|primary photocurrent)$/i });
  r('Idark', 'id');
  r('Bel', 'B', { d: /^(bandwidth|3-dB bandwidth)$/i });
  r('RL', 'RL R', { d: /load resistance/i });
  r('SNR', 'SNR', { d: /linear|^signal-to-noise ratio$|electrical SNR/i });
  r('NEP', 'NEP');

  /* ---------------------------------------------------------------- semiconductors */
  q('T', 'T', 'Temperature', 'Absolute temperature.', 'K', { context: true });
  q('Eg', 'E_g', 'Bandgap', 'Energy gap between the valence and conduction bands (1.12 eV in Si, 1.42 eV in GaAs at 300 K).', 'eV', { also: 'band gap' });
  q('Eg0', 'E_g(0)', 'Bandgap at 0 K', 'Varshni parameter E_g at absolute zero.', 'eV');
  q('lamg', '\\lambda_g', 'Bandgap wavelength', 'Longest wavelength the material absorbs: λ_g = hc/E_g.', 'm', { also: 'cutoff wavelength' });
  q('Nc', 'N_c', 'Effective density of states (conduction band)', 'N_c = 2(2πm_n*k_BT/h²)^{3/2}; 2.8×10¹⁹ cm⁻³ in Si at 300 K.', '1/cm^3');
  q('Nv', 'N_v', 'Effective density of states (valence band)', 'N_v = 2(2πm_p*k_BT/h²)^{3/2}; 1.04×10¹⁹ cm⁻³ in Si at 300 K.', '1/cm^3');
  q('ni', 'n_i', 'Intrinsic carrier density', 'Electron (= hole) density in undoped material; 1.5×10¹⁰ cm⁻³ in Si at 300 K. n₀p₀ = n_i².', '1/cm^3');
  q('n0', 'n_0', 'Electron density', 'Thermal-equilibrium electron concentration in the conduction band. In n-type material with full ionization, n₀ ≈ N_d.', '1/cm^3', { also: 'n, N_d (n-type)' });
  q('p0', 'p_0', 'Hole density', 'Thermal-equilibrium hole concentration in the valence band. In p-type material with full ionization, p₀ ≈ N_a.', '1/cm^3', { also: 'p, N_a (p-type)' });
  q('Nd', 'N_d', 'Donor density', 'Concentration of donor atoms (n-type doping). Fully ionized: n₀ ≈ N_d.', '1/cm^3', { also: 'N_D, n₀ (n-type)', input: true });
  q('Na', 'N_a', 'Acceptor density', 'Concentration of acceptor atoms (p-type doping). Fully ionized: p₀ ≈ N_a.', '1/cm^3', { also: 'N_A, p₀ (p-type)', input: true });
  q('mn', 'm_n^*', 'Electron effective mass (DOS)', 'Density-of-states effective mass of electrons; 1.08 m₀ in Si.', 'kg');
  q('mp', 'm_p^*', 'Hole effective mass (DOS)', 'Density-of-states effective mass of holes; 0.56 m₀ in Si.', 'kg');
  q('EcEF', 'E_c-E_F', 'E_c − E_F', 'How far the Fermi level lies below the conduction-band edge.', 'eV');
  q('EFEv', 'E_F-E_v', 'E_F − E_v', 'How far the Fermi level lies above the valence-band edge.', 'eV');
  q('EFEFi', 'E_F-E_{Fi}', 'E_F − E_Fi', 'Fermi level relative to the intrinsic Fermi level (positive in n-type).', 'eV');
  q('mu', '\\mu', 'Mobility', 'Carrier mobility: drift velocity per field.', 'cm^2/(V*s)');
  q('mun', '\\mu_n', 'Electron mobility', 'Electron mobility; 1350 cm²/(V·s) in lightly doped Si.', 'cm^2/(V*s)');
  q('mup', '\\mu_p', 'Hole mobility', 'Hole mobility; 480 cm²/(V·s) in lightly doped Si.', 'cm^2/(V*s)');
  q('Dc', 'D', 'Diffusion coefficient', 'Carrier diffusion coefficient; D = μk_BT/e (Einstein).', 'cm^2/s');
  q('Dn', 'D_n', 'Electron diffusion coefficient', 'Diffusion coefficient of electrons.', 'cm^2/s');
  q('Dp', 'D_p', 'Hole diffusion coefficient', 'Diffusion coefficient of holes.', 'cm^2/s');
  q('tauc', '\\tau', 'Carrier lifetime', 'Excess-carrier (recombination) lifetime.', 's');
  q('taun', '\\tau_n', 'Electron lifetime', 'Minority-electron lifetime (in p-type material).', 's');
  q('taup', '\\tau_p', 'Hole lifetime', 'Minority-hole lifetime (in n-type material).', 's');
  q('Ldiff', 'L', 'Diffusion length', 'L = √(Dτ): how far excess carriers diffuse before recombining.', 'm');
  q('Ln', 'L_n', 'Electron diffusion length', 'L_n = √(D_nτ_n).', 'm');
  q('Lp', 'L_p', 'Hole diffusion length', 'L_p = √(D_pτ_p).', 'm');
  q('sigc', '\\sigma', 'Conductivity', 'Electrical conductivity σ = e(nμ_n + pμ_p).', 'S/cm');
  q('rhoe', '\\rho', 'Resistivity', 'Electrical resistivity ρ = 1/σ.', 'ohm*cm');
  q('es', '\\varepsilon_s', 'Semiconductor permittivity', 'Permittivity of the semiconductor, ε_rε₀ (11.7ε₀ in Si).', 'F/m');
  q('er', '\\varepsilon_r', 'Relative permittivity', 'Dielectric constant ε/ε₀.', '', { also: 'dielectric constant' });
  q('Vbi', 'V_{bi}', 'Built-in potential', 'Built-in potential of a p–n junction: (k_BT/e) ln(N_aN_d/n_i²).', 'V');
  q('Va', 'V_a', 'Applied voltage', 'Forward bias across the junction (negative for reverse bias).', 'V', { also: 'V_F' });
  q('VR', 'V_R', 'Reverse bias', 'Reverse voltage across the junction.', 'V');
  q('Wdep', 'W', 'Depletion width', 'Total width of the space-charge region.', 'm');
  q('Js', 'J_s', 'Saturation current density', 'Reverse saturation current density of a diode.', 'A/cm^2');
  q('Is', 'I_s', 'Saturation current', 'Reverse saturation current of a diode.', 'A');
  q('nid', 'n', 'Ideality factor', 'Diode ideality factor (1 to 2).', '');
  q('Cox', 'C_{ox}', 'Oxide capacitance', 'Gate-oxide capacitance per area, ε_ox/t_ox.', 'F/m^2');
  q('VT', 'V_T', 'Threshold voltage', 'MOSFET threshold voltage.', 'V');
  q('VGS', 'V_{GS}', 'Gate–source voltage', 'Gate–source voltage of a FET.', 'V');
  q('VDS', 'V_{DS}', 'Drain–source voltage', 'Drain–source voltage of a FET.', 'V');
  q('ID', 'I_D', 'Drain current', 'Drain current of a FET.', 'A');
  q('phifp', '\\phi_{fp}', 'Fermi potential (p-type)', 'φ_fp = (k_BT/e) ln(N_a/n_i).', 'V');
  q('Jd', 'J', 'Diode current density', 'Current density through a biased p–n junction.', 'A/cm^2');
  q('phiph', '\\phi', 'Photon flux density', 'Photons arriving per area per second, φ = I₀/E_phot.', '1/(cm^2*s)');
  q('JL', 'J_L', 'Photocurrent density', 'Current density the light produces; the short-circuit current density J_sc of a solar cell.', 'mA/cm^2', { also: 'J_sc, short-circuit current density' });
  q('Voc', 'V_{oc}', 'Open-circuit voltage', 'Voltage of an illuminated solar cell with no load.', 'V');
  q('Qth', 'Q_{th}', 'Thermalization heat', 'Heat per area from carriers relaxing to the band edges.', 'mW/cm^2');
  q('xn', 'x_n', 'Depletion width (n side)', 'How far the space-charge region reaches into the n side.', 'µm');
  q('xp', 'x_p', 'Depletion width (p side)', 'How far the space-charge region reaches into the p side.', 'µm');
  q('Emax', '|E_{max}|', 'Peak junction field', 'Largest electric field in the depletion region, at the junction.', 'V/cm');
  q('Rmax', '\\mathcal{R}_{max}', 'Maximum responsivity', 'Responsivity with every photon giving one electron, e/E_phot.', 'A/W');
  q('Jdrf', 'J_{drf}', 'Drift current density', 'Current density from carriers drifting in a field.', 'A/cm^2');
  q('Efield', 'E', 'Electric field', 'Electric field in the semiconductor.', 'V/cm');
  q('GL', 'G_L', 'Generation rate', 'Electron–hole pairs generated per volume per second.', '1/(cm^3*s)');
  q('dnex', '\\delta n', 'Excess carrier density', 'Excess electrons (= excess holes) above equilibrium.', '1/cm^3', { also: 'δp' });
  q('dsig', '\\Delta\\sigma', 'Photoconductivity', 'Extra conductivity from excess carriers.', 'S/cm');
  q('tn', 't_n', 'Electron transit time', 'Time for an electron to drift between the contacts.', 's');
  q('dpen', 'd_{1/e}', 'Penetration depth', 'Depth where the intensity has fallen to 1/e: 1/α.', 'µm');
  r('JL', 'JL', { d: /photocurrent/i });
  r('Voc', 'Voc');
  r('GL', 'GL gp', { d: /generation rate/i });
  r('Efield', 'E', { d: /^(electric field|field)$/i, w: SEMI });
  r('T', 'T', { d: /temperature|^bandgap at T$/i });
  r('Eg', 'Eg', { d: /bandgap/i, x: /0 K/ });
  r('Eg0', 'Eg0');
  r('lamg', 'lamg');
  r('Nc', 'Nc');
  r('Nv', 'Nv');
  r('ni', 'ni');
  r('n0', 'n0 n', { d: /electron density|equilibrium electron density/i });
  r('p0', 'p0 p', { d: /^hole density$/i });
  r('Nd', 'Nd', { d: /donor/i });
  r('Na', 'Na', { d: /acceptor/i });
  r('mn', 'mn', { d: /electron DOS mass|density-of-states mass/i });
  r('mp', 'mp', { d: /hole DOS mass/i });
  r('EcEF', 'dE', { d: /^E_c − E_F$/ });
  r('EFEv', 'dE', { d: /^E_F − E_v$/ });
  r('EFEFi', 'dE', { d: /^E_F − E_Fi$/ });
  r('mu', 'mu', { d: /^(mobility|total mobility)$/i });
  r('mun', 'mun');
  r('mup', 'mup');
  r('Dc', 'D', { d: /^diffusion coefficient$/i });
  r('Dn', 'Dn', { d: /electron diffusion/i });
  r('Dp', 'Dp', { d: /hole diffusion/i });
  r('tauc', 'tau', { d: /^(lifetime|carrier lifetime)$/i, w: SEMI });
  r('taun', 'taun');
  r('taup', 'taup');
  r('Ldiff', 'L', { d: /^diffusion length$/i });
  r('Ln', 'Ln');
  r('Lp', 'Lp');
  r('sigc', 'sig', { d: /conductivity/i });
  r('rhoe', 'rho', { d: /resistivity/i });
  r('es', 'es');
  r('er', 'er');
  r('Vbi', 'Vbi');
  r('Va', 'Va', { d: /applied|forward/i });
  r('VR', 'VR');
  r('Wdep', 'W', { d: /depletion width/i });
  r('Js', 'Js');
  r('Is', 'Is IS', { d: /saturation current$/i });
  r('nid', 'nid');
  r('Cox', 'Cox');
  r('VT', 'VT');
  r('VGS', 'VGS');
  r('VDS', 'VDS');
  r('ID', 'ID', { d: /drain current/i });
  r('phifp', 'phif');

  /* ---------------------------------------------------------------- general physics (library) */
  q('mass', 'm', 'Mass', 'Mass of the body.', 'kg');
  q('v', 'v', 'Speed', 'Speed (magnitude of the velocity).', 'm/s');
  q('F', 'F', 'Force', 'Force.', 'N');
  q('t', 't', 'Time', 'Elapsed time.', 's');
  q('V', 'V', 'Voltage', 'Electric potential difference.', 'V');
  q('Iel', 'I', 'Current', 'Electric current.', 'A');
  q('Rel', 'R', 'Resistance', 'Electrical resistance.', 'ohm');
  q('Cp', 'C', 'Capacitance', 'Electrical capacitance.', 'F');
  q('Lind', 'L', 'Inductance', 'Electrical inductance.', 'H');
  q('Pel', 'P', 'Power', 'Power (electrical or mechanical).', 'W');
  q('E', 'E', 'Energy', 'Energy.', 'J');
  q('Vol', 'V', 'Volume', 'Volume.', 'm^3');
  q('A', 'A', 'Area', 'Area.', 'm^2');
  q('r', 'r', 'Radius', 'Radius or distance from the centre.', 'm');
  q('freq', 'f', 'Frequency', 'Frequency of an oscillation or signal.', 'Hz');
  q('rho', '\\rho', 'Density', 'Mass density.', 'kg/m^3');
  q('pres', 'P', 'Pressure', 'Pressure.', 'Pa');
  q('Emod', 'E', 'Young’s modulus', 'Elastic (Young’s) modulus.', 'Pa');
  r('mass', 'm', { d: /^mass$/i });
  r('v', 'v', { d: /^(speed|velocity)$/i });
  r('F', 'F', { d: /^force$/i });
  r('t', 't', { d: /^time$/i });
  r('V', 'V', { d: /^voltage$/i });
  r('Iel', 'I', { d: /^current$/i });
  r('Rel', 'R', { d: /^resistance$/i });
  r('Cp', 'Cp Cap', { d: /^capacitance$/i });
  r('Lind', 'Ld', { d: /inductance/i });
  r('Pel', 'P', { d: /^(power|real power)$/i });
  r('E', 'E', { d: /^(energy|total energy)$/i });
  r('Vol', 'V', { d: /^volume$/i });
  r('A', 'A', { d: /^(area|cross-section|cross-section area)$/i });
  r('r', 'r', { d: /^radius$/i });
  r('freq', 'f', { d: /^frequency$/i });
  r('rho', 'rho', { d: /^(density|density ρ)$/i });
  r('pres', 'P', { d: /^pressure$/i });
  r('Emod', 'E', { d: /modulus/i });

  self.QUANTITIES = { Q, RULES };
})();
