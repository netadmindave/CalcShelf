const {tex2giac}=require('../app/www/js/tex2giac.js');
const T=[
 ['2x^2+3x-1','2*x^2+3*x-1'],['\\frac{1}{2}','(1)/(2)'],['\\frac12','(1)/(2)'],['\\sqrt{2}','sqrt(2)'],['\\sqrt[3]{8}','surd(8,3)'],
 ['\\sin\\left(x\\right)','sin(x)'],['\\sin^{-1}\\left(0.5\\right)','asin(0.5)'],['\\sin^2x','(sin(x))^(2)'],['\\int_{0}^{1}x^2\\,\\mathrm{d}x','integrate(x^2,x,0,1)'],
 ['\\int x\\,dx','integrate(x,x)'],['\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(x^3\\right)','diff((x^3),x)'],['\\frac{d^2}{dx^2}\\left(\\sin(x)\\right)','diff((sin(x)),x,2)'],
 ['\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}','[[1,2],[3,4]]'],['\\left(x+1\\right)\\left(x-1\\right)','(x+1)*(x-1)'],['\\left|x\\right|','abs(x)'],
 ['\\pi r^2','pi*r^2'],['\\sum_{n=1}^{10}n^2','sum(n^2,n,1,10)'],['\\lim_{x\\to0}\\frac{\\sin\\left(x\\right)}{x}','limit((sin(x))/(x),x,0)'],
 ['x\\le3','x<=3'],['x\\ne3','x!=3'],['5\\to a','5=>a'],['\\ln\\left(x\\right)+\\log\\left(x\\right)','ln(x)+log10(x)'],['e^{x}','exp(x)'],
 ['2\\cdot3','2*3'],['f\\left(x\\right)\\coloneq x^2','f(x):=x^2'],['\\lbrace1,2,3\\rbrace','[1,2,3]'],['x_{1}+2','x_1+2'],['\\theta+\\alpha','theta+alpha'],
 ['\\infty','infinity'],['5!','5!'],['30\\degree','(30*pi/180)'],['\\mathrm{factor}\\left(x^2-1\\right)','factor(x^2-1)'],['factor\\left(x^2-1\\right)','factor(x^2-1)'],
 ['solve\\left(x^2=4,x\\right)','solve(x^2=4,x)'],['2\\left(x+1\\right)','2*(x+1)'],['x\\left(x+1\\right)','x*(x+1)'],['f\\left(2\\right)','f(2)'],
 ['\\log_{2}\\left(8\\right)','logb(8,2)'],['xy','xy'],['2xy','2*xy'],['3\\pi','3*pi'],['\\frac{x}{2}\\sin\\left(x\\right)','(x)/(2)*sin(x)'],
 ['\\operatorname{Define}f\\left(x\\right)=x^2+1','f(x):=x^2+1'],['1.5\\times10^{-3}','1.5*10^(-3)'],['x^{\\prime}','x\''],['y\'\'+y=0','y\'\'+y=0'],
 ['\\begin{cases}x & x>0\\\\ -x & \\text{otherwise}\\end{cases}','piecewise(x>0,x,-x)'],['\\left\\lbrace1,2\\right\\rbrace','[1,2]'],
 ['\\lim_{x\\to0^{+}}\\frac{1}{x}','limit((1)/(x),x,0,1)'],['\\prod_{k=1}^{5}k','product(k,k,1,5)'],['d\\left(x^2,x\\right)','diff(x^2,x)'],
 ['10\\%','10/100'],['\\sqrt{x}\\sqrt{y}','sqrt(x)*sqrt(y)'],['\\exponentialE^{i\\pi}','exp(i*pi)'],['3\\text{_m}','3*_m'],['\\frac{\\placeholder{}}{2}','ERR'],
 ['\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}','det([[1,2],[3,4]])'],['\\cos^{2}\\left(x\\right)+\\sin^{2}\\left(x\\right)','(cos(x))^(2)+(sin(x))^(2)'],
 ['\\frac{\\mathrm{d}y}{\\mathrm{d}x}=y','diff(y,x)=y'],['\\int_{0}^{\\pi}\\sin\\left(x\\right)\\,\\mathrm{d}x','integrate(sin(x),x,0,pi)'],
];
let ok=0; for(const [t,want] of T){ let got; try{got=tex2giac(t)}catch(e){got='ERR'} const pass=got===want; if(pass)ok++; else console.log('FAIL',JSON.stringify(t),'\n   got ',got,'\n   want',want); }
console.log(ok+'/'+T.length);
