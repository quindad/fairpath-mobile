export function formatUsPhone(raw:string){
 const d=raw.replace(/\D/g,'').slice(0,10);
 if(d.length<=3)return d;
 if(d.length<=6)return '('+d.slice(0,3)+') '+d.slice(3);
 return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6);
}
export function formatDateInput(raw:string){
 const d=raw.replace(/\D/g,'').slice(0,8);
 if(d.length<=2)return d;
 if(d.length<=4)return d.slice(0,2)+'/'+d.slice(2);
 return d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4);
}
export function isValidDateText(text:string,{allowFuture=true}:{allowFuture?:boolean}={}){
 const m=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!m)return false;
 const month=Number(m[1]),day=Number(m[2]),year=Number(m[3]);
 const date=new Date(year,month-1,day);
 if(year<1900||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return false;
 if(!allowFuture&&date.getTime()>Date.now())return false;
 return true;
}
export function isValidEmail(text:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())}
export function digitsOnly(raw:string,max=12){return raw.replace(/\D/g,'').slice(0,max)}

export function dateTextToLocalDate(text:string){const m=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return null;const d=new Date(Number(m[3]),Number(m[1])-1,Number(m[2]));return Number.isNaN(d.getTime())?null:d}
export function isTodayOrFutureDateText(text:string){const d=dateTextToLocalDate(text);if(!d)return false;const today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);return d.getTime()>=today.getTime()}
