// Formulas for the Optics module following the topics of five more books:
//   O. Svelto, Principles of Lasers, 4th ed. (Plenum, 1998), cited "Svelto" with the chapter;
//   E. Hecht, Optics, 5th ed. (Pearson, 2017), cited "Hecht";
//   G. P. Agrawal, Fiber-Optic Communication Systems, 4th ed. (Wiley, 2010), cited "Agrawal FOCS";
//   G. P. Agrawal, Nonlinear Fiber Optics, 6th ed. (Academic Press, 2019), cited "Agrawal NLFO";
//   C. Rullière (ed.), Femtosecond Laser Pulses, 2nd ed. (Springer, 2005), cited "Rullière".
// The equations are the standard results of each topic, written out here; the books are cited so you can look up
// the derivation and conventions. Variables are in SI units; the solver's unit menus convert from ps, nm, km and so on.
module.exports = function opticsBooks2() {
  const C = { c: '299792458', h: '6.62607015e-34', kB: '1.380649e-23', q: '1.602176634e-19', e0: '8.8541878128e-12', m0: '9.1093837015e-31' };
  const c = ['c', 'speed of light c', 'm/s', C.c], h = ['h', 'Planck constant h', 'J·s', C.h], kB = ['kB', 'Boltzmann constant k', 'J/K', C.kB], q = ['q', 'elementary charge e', 'C', C.q];
  const F = (n, tex, eq, v, note) => ({ type: 'formula', title: n, tex, eq, vars: v, note: note || '' });
  const SV = (ch) => 'Svelto, Principles of Lasers, ch. ' + ch + '.';
  const HE = (ch) => 'Hecht, Optics, ch. ' + ch + '.';
  const FO = (ch) => 'Agrawal, Fiber-Optic Communication Systems, ch. ' + ch + '.';
  const NL = (ch) => 'Agrawal, Nonlinear Fiber Optics, ch. ' + ch + '.';
  const RU = (ch) => 'Rullière (ed.), Femtosecond Laser Pulses, ch. ' + ch + '.';
  const sections = [];

  /* ---------------------------------------------------------------- Svelto: CW lasers, pumping, transients, beams */
  sections.push({ title: 'Laser design', items: [
    F('Logarithmic mirror loss', '\\gamma=-\\ln R', 'gam=-ln(R)', [['gam', 'logarithmic loss γ', ''], ['R', 'mirror reflectance (or 1 − loss)', '', '0.95']], SV(1) + ' For small losses γ ≈ 1 − R.'),
    F('Total single-pass loss', '\\gamma=\\gamma_i+\\frac{\\gamma_1+\\gamma_2}{2}', 'gam=gi+(g1+g2)/2', [['gam', 'total single-pass loss γ', ''], ['gi', 'internal loss γᵢ', '', '0'], ['g1', 'mirror 1 loss γ₁ = −ln R₁', '', '0'], ['g2', 'output-coupler loss γ₂ = −ln R₂', '']], SV(7)),
    F('Effective cavity length', 'L_e=L+(n-1)l', 'Le=L+(n-1)*l', [['Le', 'effective (optical) length', 'm'], ['L', 'mirror spacing', 'm'], ['n', 'index of the active medium', '', '1.82'], ['l', 'length of the active medium', 'm']], SV(7)),
    F('Cavity photon lifetime', '\\tau_c=\\frac{L_e}{c\\,\\gamma}', 'tc=Le/(c*gam)', [['tc', 'photon lifetime', 's'], ['Le', 'effective cavity length', 'm'], c, ['gam', 'total single-pass loss γ', '']], SV(5) + ' and ch. 7.'),
    F('Critical inversion', 'N_c=\\frac{\\gamma}{\\sigma_e l}', 'Nc=gam/(sig*l)', [['Nc', 'critical (threshold) inversion', '1/m³'], ['gam', 'total single-pass loss γ', ''], ['sig', 'stimulated-emission cross section', 'm²'], ['l', 'length of the active medium', 'm']], SV(7)),
    F('Threshold pump rate (four-level)', 'R_{cp}=\\frac{N_c}{\\tau}', 'Rcp=Nc/tau', [['Rcp', 'critical pump rate', '1/(m³·s)'], ['Nc', 'critical inversion', '1/m³'], ['tau', 'upper-level lifetime', 's']], SV(7)),
    F('Threshold pump power (longitudinal diode pumping)', 'P_{th}=\\frac{\\gamma}{\\eta_p}\\frac{h\\nu_p}{\\tau}\\frac{\\pi(w_0^2+w_p^2)}{2\\sigma_e}', 'Pth=gam/etap*h*nup/tau*pi*(w0^2+wp^2)/(2*sig)',
      [['Pth', 'threshold pump power', 'W'], ['gam', 'total single-pass loss γ', ''], ['etap', 'pump efficiency', '', '0.8'], h, ['nup', 'pump frequency', 'Hz'], ['tau', 'upper-level lifetime', 's'], ['w0', 'laser mode spot size', 'm'], ['wp', 'pump spot size', 'm'], ['sig', 'stimulated-emission cross section', 'm²']], SV(6) + ' Gaussian pump and mode, four-level medium.'),
    F('Laser output power above threshold', 'P_{out}=A_bI_s\\frac{\\gamma_2}{2}\\left(\\frac{P_p}{P_{th}}-1\\right)', 'Pout=Ab*Is*g2/2*(Pp/Pth-1)',
      [['Pout', 'output power', 'W'], ['Ab', 'mode cross-section area', 'm²'], ['Is', 'saturation intensity hν/(στ)', 'W/m²'], ['g2', 'output-coupler loss γ₂', ''], ['Pp', 'pump power', 'W'], ['Pth', 'threshold pump power', 'W']], SV(7) + ' Four-level laser, mirror 1 fully reflecting (Rigrod).'),
    F('Laser slope efficiency', '\\eta_s=\\eta_p\\,\\eta_c\\,\\eta_q\\,\\eta_t', 'etas=etap*etac*etaq*etat', [['etas', 'slope efficiency', ''], ['etap', 'pump efficiency', ''], ['etac', 'output-coupling efficiency γ₂/2γ', ''], ['etaq', 'quantum efficiency hν/hν_p', ''], ['etat', 'transverse efficiency', '', '1']], SV(7)),
    F('Output-coupling efficiency', '\\eta_c=\\frac{\\gamma_2}{2\\gamma}', 'etac=g2/(2*gam)', [['etac', 'output-coupling efficiency', ''], ['g2', 'output-coupler loss γ₂', ''], ['gam', 'total single-pass loss γ', '']], SV(7)),
    F('Quantum efficiency of the pump', '\\eta_q=\\frac{h\\nu}{h\\nu_p}=\\frac{\\lambda_p}{\\lambda}', 'etaq=lamp/lam', [['etaq', 'quantum (Stokes) efficiency', ''], ['lamp', 'pump wavelength', 'm'], ['lam', 'laser wavelength', 'm']], SV(6)),
    F('Pump absorption efficiency', '\\eta_a=1-e^{-\\alpha_pl}', 'etaa=1-exp(-ap*l)', [['etaa', 'absorbed fraction of the pump', ''], ['ap', 'absorption coefficient at the pump wavelength', '1/m'], ['l', 'crystal length', 'm']], SV(6) + ' Single pass.'),
    F('Optimum output coupling', '\\left(\\gamma_2\\right)_{op}=2\\gamma_i\\left(\\sqrt{x_m}-1\\right)', 'g2op=2*gi*(sqrt(xm)-1)', [['g2op', 'optimum output-coupler loss γ₂', ''], ['gi', 'internal loss γᵢ', ''], ['xm', 'pump power over the minimum threshold (γ₂ = 0)', '']], SV(7)),
    F('Relaxation oscillation frequency', '\\omega_R=\\sqrt{\\frac{x-1}{\\tau_c\\,\\tau}}', 'omR=sqrt((x-1)/(tc*tau))', [['omR', 'angular frequency of the spiking', 'rad/s'], ['x', 'pump rate over threshold', '', '2'], ['tc', 'photon lifetime', 's'], ['tau', 'upper-level lifetime', 's']], SV(8)),
    F('Relaxation oscillation damping time', 't_0=\\frac{2\\tau}{x}', 't0=2*tau/x', [['t0', 'damping time', 's'], ['tau', 'upper-level lifetime', 's'], ['x', 'pump rate over threshold', '', '2']], SV(8)),
    F('Q-switch energy utilization', '\\frac{N_i}{N_p}\\eta_E=-\\ln(1-\\eta_E)', 'r=-ln(1-etaE)/etaE', [['etaE', 'energy utilization factor η_E', ''], ['r', 'initial inversion over threshold Nᵢ/N_p', '', '2']], SV(8) + ' Solve for η_E (between 0 and 1).'),
    F('Q-switched pulse energy', 'E=\\frac{\\gamma_2}{2\\gamma}\\eta_EN_iA\\,l\\,h\\nu', 'E=g2/(2*gam)*etaE*Ni*A*l*h*nu', [['E', 'output pulse energy', 'J'], ['g2', 'output-coupler loss γ₂', ''], ['gam', 'total single-pass loss γ', ''], ['etaE', 'energy utilization', ''], ['Ni', 'initial inversion', '1/m³'], ['A', 'mode area', 'm²'], ['l', 'length of the active medium', 'm'], h, ['nu', 'laser frequency', 'Hz']], SV(8) + ' Four-level laser.'),
    F('Q-switched pulse duration', '\\Delta\\tau_p=\\tau_c\\frac{(N_i/N_p)\\,\\eta_E}{N_i/N_p-\\ln(N_i/N_p)-1}', 'dtp=tc*r*etaE/(r-ln(r)-1)', [['dtp', 'pulse width (FWHM, approximately)', 's'], ['tc', 'photon lifetime', 's'], ['r', 'Nᵢ/N_p', '', '2'], ['etaE', 'energy utilization', '']], SV(8)),
    F('Frequency pulling', '\\nu_{osc}=\\frac{\\nu_c\\Delta\\nu_0+\\nu_0\\Delta\\nu_c}{\\Delta\\nu_0+\\Delta\\nu_c}', 'nuo=(nuc*dnu0+nu0*dnuc)/(dnu0+dnuc)',
      [['nuo', 'oscillation frequency', 'Hz'], ['nuc', 'cavity-mode frequency', 'Hz'], ['dnu0', 'gain linewidth', 'Hz'], ['nu0', 'line-centre frequency', 'Hz'], ['dnuc', 'cavity linewidth', 'Hz']], SV(7) + ' Homogeneous line.'),
    F('Collision (pressure) broadening', '\\Delta\\nu_c=\\frac{1}{\\pi\\tau_c}', 'dnuc=1/(pi*tauc)', [['dnuc', 'collision linewidth (FWHM)', 'Hz'], ['tauc', 'mean time between collisions', 's']], SV(2)),
    F('Fluorescence quantum yield', '\\phi=\\frac{\\tau}{\\tau_r}', 'phi=tau/taur', [['phi', 'quantum yield', ''], ['tau', 'measured lifetime', 's'], ['taur', 'radiative lifetime', 's']], SV(2)),
    F('Saturation fluence (amplifier)', '\\Gamma_s=\\frac{h\\nu}{\\sigma}', 'Gs=h*nu/sig', [['Gs', 'saturation fluence', 'J/m²'], h, ['nu', 'frequency', 'Hz'], ['sig', 'transition cross section', 'm²']], SV(12) + ' Four-level medium, pulse shorter than the lifetime.'),
    F('Pulsed amplifier gain (Frantz–Nodvik)', 'G=\\frac{\\Gamma_s}{\\Gamma_{in}}\\ln\\left\\{1+G_0\\left[e^{\\Gamma_{in}/\\Gamma_s}-1\\right]\\right\\}', 'G=Gs/Gin*ln(1+G0*(exp(Gin/Gs)-1))',
      [['G', 'energy gain', ''], ['Gs', 'saturation fluence', 'J/m²'], ['Gin', 'input fluence', 'J/m²'], ['G0', 'small-signal gain', '']], SV(12)),
    F('Unstable resonator output coupling', '\\gamma_{out}=1-\\frac{1}{M^2}', 'gout=1-1/M^2', [['gout', 'fraction coupled out per round trip', ''], ['M', 'round-trip magnification', '', '2']], SV(5) + ' Two-dimensional (spherical) mirrors; 1 − 1/M for cylindrical.'),
    F('Divergence of a real beam (M²)', '\\theta=M^2\\frac{\\lambda}{\\pi w_0}', 'th=M2*lam/(pi*w0)', [['th', 'far-field half-angle divergence', 'rad'], ['M2', 'beam quality factor M²', '', '1'], ['lam', 'wavelength', 'm'], ['w0', 'waist radius', 'm']], SV(11) + ' M² = 1 for a TEM₀₀ Gaussian beam.'),
    F('Beam parameter product', '\\mathrm{BPP}=w_0\\theta=M^2\\frac{\\lambda}{\\pi}', 'BPP=M2*lam/pi', [['BPP', 'beam parameter product', 'm·rad'], ['M2', 'M²', '', '1'], ['lam', 'wavelength', 'm']], SV(11)),
    F('Rayleigh range of a real beam', 'z_R=\\frac{\\pi w_0^2}{M^2\\lambda}', 'zR=pi*w0^2/(M2*lam)', [['zR', 'Rayleigh range', 'm'], ['w0', 'waist radius', 'm'], ['M2', 'M²', '', '1'], ['lam', 'wavelength', 'm']], SV(11)),
    F('Brightness of a beam', 'B=\\frac{P}{(\\pi w_0\\theta)^2}\\approx\\frac{P}{(M^2\\lambda)^2}', 'B=P/(M2*lam)^2', [['B', 'brightness (radiance)', 'W/(m²·sr)'], ['P', 'power', 'W'], ['M2', 'M²', '', '1'], ['lam', 'wavelength', 'm']], SV(11)),
    F('Speckle grain size', 'd_{sp}\\approx\\frac{\\lambda z}{D}', 'dsp=lam*z/D', [['dsp', 'speckle size', 'm'], ['lam', 'wavelength', 'm'], ['z', 'distance from the illuminated spot', 'm'], ['D', 'diameter of the illuminated spot', 'm']], SV(11)),
    F('Thermal lens of an end-pumped rod', 'f_{th}=\\frac{\\pi Kw_p^2}{P_h\\,(dn/dT)}\\frac{1}{1-e^{-\\alpha l}}', 'fth=pi*K*wp^2/(Ph*dndT)/(1-exp(-ap*l))',
      [['fth', 'thermal focal length', 'm'], ['K', 'thermal conductivity', 'W/(m·K)'], ['wp', 'pump spot radius', 'm'], ['Ph', 'heat deposited', 'W'], ['dndT', 'dn/dT', '1/K'], ['ap', 'pump absorption coefficient', '1/m'], ['l', 'rod length', 'm']], SV(6) + ' Innocenzi’s estimate; end-face bulging adds to it.'),
    F('SHG phase-matching angle (type I, negative uniaxial)', '\\sin^2\\theta_m=\\frac{n_o^{-2}(\\omega)-n_o^{-2}(2\\omega)}{n_e^{-2}(2\\omega)-n_o^{-2}(2\\omega)}', 'sin(thm)^2=(no1^(-2)-no2^(-2))/(ne2^(-2)-no2^(-2))',
      [['thm', 'phase-matching angle to the optic axis', 'rad'], ['no1', 'ordinary index at ω', '', '1.6551'], ['no2', 'ordinary index at 2ω', '', '1.6749'], ['ne2', 'extraordinary index at 2ω', '', '1.5555']], SV(12) + ' Defaults: β-BBO for 1064 → 532 nm (about 22.8°).'),
  ] });

  /* ---------------------------------------------------------------- Hecht: reflection, interference, diffraction, instruments */
  sections.push({ title: 'Classical optics', items: [
    F('Fresnel amplitude reflection, s (TE)', 'r_s=\\frac{n_i\\cos\\theta_i-n_t\\cos\\theta_t}{n_i\\cos\\theta_i+n_t\\cos\\theta_t}', 'rs=(ni*cos(thi)-nt*cos(tht))/(ni*cos(thi)+nt*cos(tht))',
      [['rs', 'amplitude reflection coefficient r⊥', ''], ['ni', 'incident index', '', '1'], ['thi', 'angle of incidence', 'rad'], ['nt', 'transmitted index', '', '1.5'], ['tht', 'angle of refraction (Snell)', 'rad']], HE(4)),
    F('Fresnel amplitude reflection, p (TM)', 'r_p=\\frac{n_t\\cos\\theta_i-n_i\\cos\\theta_t}{n_i\\cos\\theta_t+n_t\\cos\\theta_i}', 'rp=(nt*cos(thi)-ni*cos(tht))/(ni*cos(tht)+nt*cos(thi))',
      [['rp', 'amplitude reflection coefficient r∥', ''], ['ni', 'incident index', '', '1'], ['thi', 'angle of incidence', 'rad'], ['nt', 'transmitted index', '', '1.5'], ['tht', 'angle of refraction', 'rad']], HE(4) + ' Hecht’s sign convention; r∥ = 0 at Brewster’s angle.'),
    F('Fresnel amplitude transmission, s (TE)', 't_s=\\frac{2n_i\\cos\\theta_i}{n_i\\cos\\theta_i+n_t\\cos\\theta_t}', 'ts=2*ni*cos(thi)/(ni*cos(thi)+nt*cos(tht))',
      [['ts', 'amplitude transmission coefficient t⊥', ''], ['ni', 'incident index', '', '1'], ['thi', 'angle of incidence', 'rad'], ['nt', 'transmitted index', '', '1.5'], ['tht', 'angle of refraction', 'rad']], HE(4)),
    F('Fresnel amplitude transmission, p (TM)', 't_p=\\frac{2n_i\\cos\\theta_i}{n_i\\cos\\theta_t+n_t\\cos\\theta_i}', 'tp=2*ni*cos(thi)/(ni*cos(tht)+nt*cos(thi))',
      [['tp', 'amplitude transmission coefficient t∥', ''], ['ni', 'incident index', '', '1'], ['thi', 'angle of incidence', 'rad'], ['nt', 'transmitted index', '', '1.5'], ['tht', 'angle of refraction', 'rad']], HE(4)),
    F('Transmittance from the amplitude coefficient', 'T=\\frac{n_t\\cos\\theta_t}{n_i\\cos\\theta_i}t^2', 'T=nt*cos(tht)/(ni*cos(thi))*t^2',
      [['T', 'transmittance (power)', ''], ['nt', 'transmitted index', '', '1.5'], ['tht', 'angle of refraction', 'rad'], ['ni', 'incident index', '', '1'], ['thi', 'angle of incidence', 'rad'], ['t', 'amplitude transmission coefficient', '']], HE(4) + ' R = r² and R + T = 1 without absorption.'),
    F('Lorentz dispersion equation', 'n^2=1+\\frac{Nq_e^2}{\\varepsilon_0m_e}\\frac{1}{\\omega_0^2-\\omega^2}', 'n^2=1+N*q^2/(eps0*m0*(w0^2-w^2))',
      [['n', 'refractive index', ''], ['N', 'oscillators per volume', '1/m³'], q, ['eps0', 'vacuum permittivity ε₀', 'F/m', C.e0], ['m0', 'electron mass', 'kg', C.m0], ['w0', 'resonance angular frequency', 'rad/s'], ['w', 'angular frequency', 'rad/s']], HE(3) + ' One undamped resonance.'),
    F('Newton’s rings', 'r_m=\\sqrt{m\\lambda R}', 'rm=sqrt(m*lam*R)', [['rm', 'radius of the m-th dark ring', 'm'], ['m', 'ring order (0 at the centre)', '', '1'], ['lam', 'wavelength in the gap', 'm'], ['R', 'lens radius of curvature', 'm']], HE(9) + ' Reflected light, air gap.'),
    F('Thin-film reflection maxima', '2n_fd\\cos\\theta_t=\\left(m+\\tfrac12\\right)\\lambda_0', '2*nf*d*cos(tht)=(m+1/2)*lam0', [['d', 'film thickness', 'm'], ['nf', 'film index', '', '1.38'], ['tht', 'angle inside the film', 'rad', '0'], ['m', 'order', '', '0'], ['lam0', 'vacuum wavelength', 'm']], HE(9) + ' One reflection with a π phase change (film between lower-index and higher-index media, or the reverse); with zero or two, the maxima are at mλ₀.'),
    F('Coefficient of finesse', 'F=\\frac{4R}{(1-R)^2}', 'F=4*R/(1-R)^2', [['F', 'coefficient of finesse', ''], ['R', 'mirror reflectance', '', '0.9']], HE(9) + ' Finesse 𝓕 = π√F/2.'),
    F('Fabry–Pérot resolving power', '\\frac{\\lambda}{\\Delta\\lambda}=m\\mathcal F', 'RP=m*Fin', [['RP', 'resolving power λ/Δλ', ''], ['m', 'interference order 2nd/λ', ''], ['Fin', 'finesse 𝓕', '']], HE(9)),
    F('Grating angular dispersion', '\\mathcal D=\\frac{d\\theta}{d\\lambda}=\\frac{m}{a\\cos\\theta_m}', 'Dg=m/(a*cos(thm))', [['Dg', 'angular dispersion', 'rad/m'], ['m', 'order', '', '1'], ['a', 'groove spacing', 'm'], ['thm', 'diffraction angle', 'rad']], HE(10)),
    F('Fresnel zone radius', 'R_m=\\sqrt{m\\lambda r_0}', 'Rm=sqrt(m*lam*r0)', [['Rm', 'outer radius of zone m', 'm'], ['m', 'zone number', '', '1'], ['lam', 'wavelength', 'm'], ['r0', 'distance to the observation point', 'm']], HE(10) + ' Plane-wave illumination.'),
    F('Zone plate focal length', 'f_1=\\frac{R_1^2}{\\lambda}', 'f=R1^2/lam', [['f', 'primary focal length', 'm'], ['R1', 'radius of the first zone', 'm'], ['lam', 'wavelength', 'm']], HE(10)),
    F('Newtonian lens equation', 'x_ox_i=f^2', 'xo*xi=f^2', [['xo', 'object distance from the front focal point', 'm'], ['xi', 'image distance from the back focal point', 'm'], ['f', 'focal length', 'm']], HE(5)),
    F('Longitudinal magnification', 'M_L=-M_T^2', 'ML=-MT^2', [['ML', 'longitudinal magnification', ''], ['MT', 'transverse magnification', '']], HE(5) + ' Thin lens.'),
    F('Magnifying power of a magnifier', 'MP=\\frac{d_o}{f}', 'MP=d0/f', [['MP', 'magnifying power', ''], ['d0', 'near-point distance', 'm', '0.254'], ['f', 'focal length', 'm']], HE(5) + ' Image at infinity; add 1 with the image at the near point.'),
    F('Compound microscope magnification', 'MP=-\\frac{L}{f_o}\\frac{d_o}{f_e}', 'MP=-L/fo*d0/fe', [['MP', 'magnifying power', ''], ['L', 'tube length (focal points apart)', 'm', '0.16'], ['fo', 'objective focal length', 'm'], ['d0', 'near-point distance', 'm', '0.254'], ['fe', 'eyepiece focal length', 'm']], HE(5)),
    F('Telescope angular magnification', 'MP=-\\frac{f_o}{f_e}', 'MP=-fo/fe', [['MP', 'magnifying power', ''], ['fo', 'objective focal length', 'm'], ['fe', 'eyepiece focal length', 'm']], HE(5)),
    F('Telescope exit pupil', 'D_{ex}=\\frac{D_o}{|MP|}', 'Dex=Dob/abs(MP)', [['Dex', 'exit-pupil diameter', 'm'], ['Dob', 'objective diameter', 'm'], ['MP', 'magnifying power', '']], HE(5)),
    F('Sagnac phase shift', '\\Delta\\varphi=\\frac{8\\pi A\\Omega}{\\lambda c}', 'dph=8*pi*A*Om/(lam*c)', [['dph', 'phase difference', 'rad'], ['A', 'enclosed area (times the number of turns)', 'm²'], ['Om', 'rotation rate', 'rad/s'], ['lam', 'vacuum wavelength', 'm'], c], HE(9)),
    F('Relativistic Doppler shift', 'f=f_0\\sqrt{\\frac{1+\\beta}{1-\\beta}}', 'f=f0*sqrt((1+bet)/(1-bet))', [['f', 'observed frequency', 'Hz'], ['f0', 'source frequency', 'Hz'], ['bet', 'v/c (positive approaching)', '']], HE(3)),
  ] });

  /* ---------------------------------------------------------------- Agrawal FOCS: links, amplifiers, receivers */
  sections.push({ title: 'Fiber links & receivers', items: [
    F('Splice loss from a lateral offset', 'T=\\exp\\left(-\\frac{d^2}{w^2}\\right)', 'T=exp(-d^2/w^2)', [['T', 'coupling efficiency', ''], ['d', 'core offset', 'm'], ['w', 'mode-field radius', 'm']], FO(2) + ' Gaussian modes of equal size.'),
    F('Splice loss from an angular tilt', 'T=\\exp\\left[-\\left(\\frac{\\pi nw\\theta}{\\lambda}\\right)^2\\right]', 'T=exp(-(pi*n*w*th/lam)^2)', [['T', 'coupling efficiency', ''], ['n', 'index of the gap', '', '1'], ['w', 'mode-field radius', 'm'], ['th', 'tilt angle', 'rad'], ['lam', 'wavelength', 'm']], FO(2)),
    F('Splice loss from mode-size mismatch', 'T=\\left(\\frac{2w_1w_2}{w_1^2+w_2^2}\\right)^2', 'T=(2*w1*w2/(w1^2+w2^2))^2', [['T', 'coupling efficiency', ''], ['w1', 'mode-field radius 1', 'm'], ['w2', 'mode-field radius 2', 'm']], FO(2)),
    F('ASE spectral density', 'S_{sp}=n_{sp}h\\nu(G-1)', 'Ssp=nsp*h*nu*(G-1)', [['Ssp', 'ASE power per hertz, one polarization', 'W/Hz'], ['nsp', 'spontaneous-emission factor', '', '1.5'], h, ['nu', 'frequency', 'Hz'], ['G', 'amplifier gain (linear)', '']], FO(7)),
    F('Amplifier noise figure', 'F_n=2n_{sp}\\frac{G-1}{G}', 'Fn=2*nsp*(G-1)/G', [['Fn', 'noise figure (linear)', ''], ['nsp', 'spontaneous-emission factor', ''], ['G', 'gain (linear)', '']], FO(7) + ' Signal–spontaneous beat noise; 3 dB is the high-gain limit with full inversion.'),
    F('OSNR of an amplified link', '\\mathrm{OSNR}=\\frac{P_{ch}}{2N_An_{sp}h\\nu(G-1)\\Delta\\nu_o}', 'OSNR=Pch/(2*NA*nsp*h*nu*(G-1)*dnuo)',
      [['OSNR', 'optical SNR (linear)', ''], ['Pch', 'channel power at each amplifier', 'W'], ['NA', 'number of amplifiers', '', '1'], ['nsp', 'spontaneous-emission factor', '', '1.5'], h, ['nu', 'frequency', 'Hz', '193.4e12'], ['G', 'gain of each amplifier (span loss)', ''], ['dnuo', 'reference bandwidth (12.5 GHz = 0.1 nm)', 'Hz', '12.5e9']], FO(7) + ' Both polarizations of ASE.'),
    F('OSNR rule of thumb (dB, 0.1 nm)', '\\mathrm{OSNR}_{dB}=58+P_{dBm}-NF_{dB}-L_{dB}-10\\log_{10}N_A', 'OSNR=58+P-NF-Lsp-10*log10(NA)',
      [['OSNR', 'OSNR in 0.1 nm', 'dB'], ['P', 'launch power per channel', 'dBm'], ['NF', 'amplifier noise figure', 'dB', '5'], ['Lsp', 'span loss', 'dB'], ['NA', 'number of spans', '', '1']], FO(7) + ' Identical spans at 1550 nm; 58 dB = −10 log₁₀(hν·12.5 GHz/1 mW).'),
    F('Thermal noise current', '\\sigma_T^2=\\frac{4k_BT}{R_L}F_n\\Delta f', 'sT2=4*kB*T*Fn*df/RL', [['sT2', 'noise current variance', 'A²'], kB, ['T', 'temperature', 'K', '300'], ['Fn', 'amplifier noise figure (linear)', '', '1'], ['df', 'receiver bandwidth', 'Hz'], ['RL', 'load resistance', 'Ω']], FO(4)),
    F('Extinction-ratio power penalty', '\\delta_{ex}=10\\log_{10}\\frac{1+r_{ex}}{1-r_{ex}}', 'dex=10*log10((1+rex)/(1-rex))', [['dex', 'penalty', 'dB'], ['rex', 'extinction ratio P₀/P₁ (linear)', '', '0.1']], FO(4)),
    F('GVD-limited bit rate (narrow source)', 'B\\sqrt{|\\beta_2|L}=\\frac14', 'B*sqrt(abs(b2)*L)=1/4', [['B', 'bit rate', '1/s'], ['b2', 'GVD β₂', 's²/m'], ['L', 'fiber length', 'm']], FO(2) + ' Gaussian pulses; a source much narrower than the signal bandwidth.'),
    F('Dispersion compensation', 'D_1L_1+D_2L_2=0', 'D1*L1+D2*L2=0', [['L2', 'compensating fiber length', 'm'], ['D1', 'dispersion of the line fiber', 's/m²'], ['L1', 'line fiber length', 'm'], ['D2', 'dispersion of the compensating fiber', 's/m²']], FO(8)),
    F('Spectral efficiency', '\\eta_s=\\frac{B}{\\Delta\\nu_{ch}}', 'etas=B/dnuch', [['etas', 'spectral efficiency', 'bit/(s·Hz)'], ['B', 'bit rate per channel', '1/s'], ['dnuch', 'channel spacing', 'Hz']], FO(6)),
    F('Heterodyne beat current', 'I_p=2R\\sqrt{P_sP_{LO}}\\cos(\\omega_{IF}t+\\phi)', 'Ip=2*R*sqrt(Ps*PLO)', [['Ip', 'beat amplitude', 'A'], ['R', 'responsivity', 'A/W'], ['Ps', 'signal power', 'W'], ['PLO', 'local-oscillator power', 'W']], FO(10) + ' Matched polarizations; ω_IF = ω₀ − ω_LO.'),
    F('Shot-noise-limited heterodyne SNR', '\\mathrm{SNR}=\\frac{RP_s}{q\\,\\Delta f}', 'SNR=R*Ps/(q*df)', [['SNR', 'signal-to-noise ratio', ''], ['R', 'responsivity', 'A/W'], ['Ps', 'signal power', 'W'], q, ['df', 'receiver bandwidth', 'Hz']], FO(10) + ' Strong local oscillator; homodyne detection gives twice this.'),
    F('Laser diode photon lifetime', '\\tau_p^{-1}=v_g(\\alpha_{int}+\\alpha_{mir})', '1/tp=vg*(aint+amir)', [['tp', 'photon lifetime', 's'], ['vg', 'group velocity', 'm/s'], ['aint', 'internal loss', '1/m'], ['amir', 'mirror loss', '1/m']], FO(3)),
    F('Modulation bandwidth of a laser diode', 'f_{3dB}\\approx\\sqrt3\\,f_R', 'f3=sqrt(3)*fR', [['f3', '3-dB modulation bandwidth', 'Hz'], ['fR', 'relaxation-oscillation frequency', 'Hz']], FO(3) + ' Weak damping.'),
    F('Laser linewidth with the enhancement factor', '\\Delta\\nu=\\Delta\\nu_{ST}(1+\\beta_c^2)', 'dnu=dnuST*(1+bc^2)', [['dnu', 'linewidth', 'Hz'], ['dnuST', 'Schawlow–Townes linewidth', 'Hz'], ['bc', 'linewidth enhancement factor β_c (α)', '', '5']], FO(3)),
  ] });

  /* ---------------------------------------------------------------- Agrawal NLFO: nonlinear propagation */
  sections.push({ title: 'Nonlinear fiber optics', items: [
    F('Effective length', 'L_{eff}=\\frac{1-e^{-\\alpha L}}{\\alpha}', 'Leff=(1-exp(-a*L))/a', [['Leff', 'effective length', 'm'], ['a', 'loss coefficient α (dB/km ÷ 4.343)', '1/m'], ['L', 'fiber length', 'm']], NL(4)),
    F('Effective mode area (Gaussian)', 'A_{eff}=\\pi w^2', 'Aeff=pi*w^2', [['Aeff', 'effective area', 'm²'], ['w', 'mode-field radius', 'm']], NL(2)),
    F('Nonlinear length', 'L_{NL}=\\frac{1}{\\gamma P_0}', 'LNL=1/(gam*P0)', [['LNL', 'nonlinear length', 'm'], ['gam', 'nonlinear coefficient γ', '1/(W·m)'], ['P0', 'peak power', 'W']], NL(3)),
    F('Soliton order', 'N^2=\\frac{\\gamma P_0T_0^2}{|\\beta_2|}', 'N^2=gam*P0*T0^2/abs(b2)', [['N', 'soliton order', ''], ['gam', 'nonlinear coefficient γ', '1/(W·m)'], ['P0', 'peak power', 'W'], ['T0', 'pulse half-width (1/e intensity); FWHM = 1.763 T₀ for sech²', 's'], ['b2', 'GVD β₂', 's²/m']], NL(5)),
    F('Soliton period', 'z_0=\\frac{\\pi}{2}L_D=\\frac{\\pi}{2}\\frac{T_0^2}{|\\beta_2|}', 'z0=pi/2*T0^2/abs(b2)', [['z0', 'soliton period', 'm'], ['T0', 'pulse half-width T₀', 's'], ['b2', 'GVD β₂', 's²/m']], NL(5)),
    F('Maximum SPM phase shift', '\\phi_{max}=\\gamma P_0L_{eff}', 'phim=gam*P0*Leff', [['phim', 'peak nonlinear phase', 'rad'], ['gam', 'nonlinear coefficient γ', '1/(W·m)'], ['P0', 'peak power', 'W'], ['Leff', 'effective length', 'm']], NL(4)),
    F('SPM spectral broadening (Gaussian pulse)', '\\delta\\omega_{max}=0.86\\,\\frac{\\phi_{max}}{T_0}', 'dwm=0.86*phim/T0', [['dwm', 'maximum frequency chirp', 'rad/s'], ['phim', 'peak nonlinear phase', 'rad'], ['T0', 'pulse half-width (1/e intensity)', 's']], NL(4) + ' Unchirped Gaussian; dispersion neglected.'),
    F('Number of SPM spectral peaks', 'M\\approx\\frac{\\phi_{max}}{\\pi}+\\frac12', 'M=phim/pi+1/2', [['M', 'number of peaks', ''], ['phim', 'peak nonlinear phase', 'rad']], NL(4)),
    F('Modulation instability peak frequency', '\\Omega_{max}=\\sqrt{\\frac{2\\gamma P_0}{|\\beta_2|}}', 'Om=sqrt(2*gam*P0/abs(b2))', [['Om', 'angular frequency of peak gain (from the pump)', 'rad/s'], ['gam', 'nonlinear coefficient γ', '1/(W·m)'], ['P0', 'CW power', 'W'], ['b2', 'GVD β₂ (anomalous)', 's²/m']], NL(5) + ' Peak power gain 2γP₀.'),
    F('Raman threshold', 'P_{cr}\\approx\\frac{16A_{eff}}{g_RL_{eff}}', 'Pcr=16*Aeff/(gR*Leff)', [['Pcr', 'critical pump power', 'W'], ['Aeff', 'effective area', 'm²'], ['gR', 'peak Raman gain (about 1e-13 m/W at 1 µm)', 'm/W'], ['Leff', 'effective length', 'm']], NL(8) + ' Forward Stokes; peak shift about 13.2 THz in silica.'),
    F('Brillouin threshold', 'P_{cr}\\approx\\frac{21A_{eff}}{g_BL_{eff}}', 'Pcr=21*Aeff/(gB*Leff)', [['Pcr', 'critical pump power', 'W'], ['Aeff', 'effective area', 'm²'], ['gB', 'peak Brillouin gain (about 5e-11 m/W)', 'm/W'], ['Leff', 'effective length', 'm']], NL(9) + ' A CW pump narrower than the Brillouin linewidth.'),
    F('Walk-off length', 'L_W=\\frac{T_0}{|d_{12}|},\\ d_{12}=v_{g1}^{-1}-v_{g2}^{-1}', 'LW=T0/abs(d12)', [['LW', 'walk-off length', 'm'], ['T0', 'pulse half-width', 's'], ['d12', 'group-velocity mismatch', 's/m']], NL(1) + ' and ch. 7.'),
    F('Third-order dispersion length', 'L_D^\\prime=\\frac{T_0^3}{|\\beta_3|}', 'LD3=T0^3/abs(b3)', [['LD3', 'TOD length', 'm'], ['T0', 'pulse half-width', 's'], ['b3', 'TOD β₃', 's³/m']], NL(3)),
    F('XPM phase shift', '\\phi_{XPM}=2\\gamma P_2L_{eff}', 'phX=2*gam*P2*Leff', [['phX', 'cross-phase shift on wave 1', 'rad'], ['gam', 'nonlinear coefficient γ', '1/(W·m)'], ['P2', 'power of the other wave', 'W'], ['Leff', 'effective length', 'm']], NL(7) + ' Same polarization; twice the SPM of an equal power.'),
    F('Chirped Gaussian pulse broadening', '\\frac{T_1}{T_0}=\\sqrt{\\left(1+\\frac{C\\beta_2z}{T_0^2}\\right)^2+\\left(\\frac{\\beta_2z}{T_0^2}\\right)^2}', 'T1/T0=sqrt((1+C0*b2*z/T0^2)^2+(b2*z/T0^2)^2)',
      [['T1', 'width after z', 's'], ['T0', 'input half-width', 's'], ['C0', 'chirp parameter C', '', '0'], ['b2', 'GVD β₂', 's²/m'], ['z', 'distance', 'm']], NL(3) + ' A pulse with Cβ₂ < 0 first compresses.'),
    F('Soliton self-frequency shift', '\\frac{d\\Omega_p}{dz}=-\\frac{8T_R|\\beta_2|}{15T_0^4}', 'dOm=-8*TR*abs(b2)/(15*T0^4)', [['dOm', 'rate of the shift', 'rad/(s·m)'], ['TR', 'Raman response parameter (about 3 fs)', 's', '3e-15'], ['b2', 'GVD β₂', 's²/m'], ['T0', 'soliton half-width', 's']], NL(5) + ' Fundamental soliton.'),
    F('Soliton-effect compression factor', 'F_c\\approx4.1N', 'Fc=4.1*N', [['Fc', 'compression factor', ''], ['N', 'soliton order', '']], NL(6) + ' At the optimum length z_opt ≈ z₀(0.32/N + 1.1/N²).'),
    F('Optimum fiber length for soliton compression', 'z_{opt}\\approx z_0\\left(\\frac{0.32}{N}+\\frac{1.1}{N^2}\\right)', 'zopt=z0*(0.32/N+1.1/N^2)', [['zopt', 'optimum length', 'm'], ['z0', 'soliton period', 'm'], ['N', 'soliton order', '']], NL(6)),
    F('Soliton fission length', 'L_{fiss}\\approx\\frac{L_D}{N}', 'Lfis=LD/N', [['Lfis', 'fission length', 'm'], ['LD', 'dispersion length T₀²/|β₂|', 'm'], ['N', 'soliton order', '']], NL(13) + ' Onset of supercontinuum from a higher-order soliton.'),
  ] });

  /* ---------------------------------------------------------------- Rullière: ultrashort pulses */
  sections.push({ title: 'Ultrafast pulses', items: [
    F('Gaussian pulse FWHM', '\\tau_{FWHM}=2\\sqrt{\\ln2}\\,T_0\\approx1.665\\,T_0', 'tau=2*sqrt(ln(2))*T0', [['tau', 'intensity FWHM', 's'], ['T0', '1/e half-width of the intensity', 's']], RU(2)),
    F('sech² pulse FWHM', '\\tau_{FWHM}=2\\ln(1+\\sqrt2)\\,T_0\\approx1.763\\,T_0', 'tau=2*ln(1+sqrt(2))*T0', [['tau', 'intensity FWHM', 's'], ['T0', 'sech² width parameter', 's']], RU(2)),
    F('Time–bandwidth product (sech²)', '\\Delta\\nu\\,\\tau=0.315', 'dnu*tau=0.315', [['dnu', 'spectral FWHM', 'Hz'], ['tau', 'pulse FWHM', 's']], RU(8) + ' Transform-limited; 0.441 for a Gaussian.'),
    F('Spectral width in wavelength', '\\Delta\\lambda=\\frac{\\lambda^2}{c}\\Delta\\nu', 'dlam=lam^2*dnu/c', [['dlam', 'spectral width', 'm'], ['lam', 'centre wavelength', 'm'], ['dnu', 'spectral width', 'Hz'], c], RU(2)),
    F('Group delay dispersion of a material', '\\mathrm{GDD}=\\frac{\\lambda^3L}{2\\pi c^2}\\frac{d^2n}{d\\lambda^2}', 'GDD=lam^3*L/(2*pi*c^2)*d2n', [['GDD', 'group delay dispersion', 's²'], ['lam', 'vacuum wavelength', 'm'], ['L', 'thickness', 'm'], c, ['d2n', 'd²n/dλ²', '1/m²']], RU(2) + ' Fused silica at 800 nm: about 36 fs²/mm.'),
    F('Gaussian pulse after GDD', '\\tau_{out}=\\tau_{in}\\sqrt{1+\\left(\\frac{4\\ln2\\,\\mathrm{GDD}}{\\tau_{in}^2}\\right)^2}', 'tout=tin*sqrt(1+(4*ln(2)*GDD/tin^2)^2)', [['tout', 'output FWHM', 's'], ['tin', 'input FWHM (transform-limited)', 's'], ['GDD', 'group delay dispersion', 's²']], RU(2)),
    F('Stretched pulse duration (large GDD)', '\\tau_{out}\\approx\\frac{4\\ln2\\,|\\mathrm{GDD}|}{\\tau_{in}}', 'tout=4*ln(2)*abs(GDD)/tin', [['tout', 'output FWHM', 's'], ['GDD', 'group delay dispersion', 's²'], ['tin', 'input FWHM', 's']], RU(6) + ' Gaussian pulse in a CPA stretcher.'),
    F('Grating-pair GDD', '\\mathrm{GDD}=-\\frac{\\lambda^3b}{2\\pi c^2d^2}\\left[1-\\left(\\frac{\\lambda}{d}-\\sin\\gamma\\right)^2\\right]^{-1}', 'GDD=-lam^3*b/(2*pi*c^2*dg^2)/(1-(lam/dg-sin(gi))^2)',
      [['GDD', 'group delay dispersion (single pass)', 's²'], ['lam', 'wavelength', 'm'], ['b', 'slant distance between the gratings', 'm'], c, ['dg', 'groove spacing', 'm'], ['gi', 'angle of incidence γ', 'rad']], RU(2) + ' Double it for the usual double pass.'),
    F('Peak intensity of a Gaussian pulse and beam', 'I_0=\\frac{0.94\\,E}{\\tau}\\frac{2}{\\pi w_0^2}', 'I0=0.94*E/tau*2/(pi*w0^2)', [['I0', 'peak intensity', 'W/m²'], ['E', 'pulse energy', 'J'], ['tau', 'pulse FWHM', 's'], ['w0', 'beam radius (1/e²)', 'm']], RU(2) + ' 0.94 for a Gaussian pulse, 0.88 for sech².'),
    F('Peak fluence of a Gaussian beam', 'F_0=\\frac{2E}{\\pi w_0^2}', 'F0=2*E/(pi*w0^2)', [['F0', 'peak fluence', 'J/m²'], ['E', 'pulse energy', 'J'], ['w0', 'beam radius (1/e²)', 'm']], RU(2)),
    F('B-integral', 'B=\\frac{2\\pi}{\\lambda}n_2I_0L', 'B=2*pi/lam*n2*I0*L', [['B', 'accumulated nonlinear phase', 'rad'], ['lam', 'wavelength', 'm'], ['n2', 'nonlinear index n₂', 'm²/W'], ['I0', 'peak intensity', 'W/m²'], ['L', 'length', 'm']], RU(6) + ' Keep below about 3–5 rad in amplifiers.'),
    F('Optical cycles in a pulse', 'N_c=\\frac{c\\,\\tau}{\\lambda}', 'Nc=c*tau/lam', [['Nc', 'cycles within the FWHM', ''], c, ['tau', 'pulse FWHM', 's'], ['lam', 'wavelength', 'm']], RU(1)),
    F('Carrier–envelope offset frequency', 'f_0=\\frac{\\Delta\\phi_{CE}}{2\\pi}f_{rep}', 'f0=dphi/(2*pi)*frep', [['f0', 'offset frequency', 'Hz'], ['dphi', 'CE phase slip per round trip (mod 2π)', 'rad'], ['frep', 'repetition rate', 'Hz']], RU(4)),
  ] });

  return sections;
};
