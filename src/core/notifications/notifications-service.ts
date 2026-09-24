import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type UserNotification={id:string;category:string;title:string;body:string;route:string|null;metadata:Record<string,unknown>;read_at:string|null;created_at:string};
export async function loadUserNotifications():Promise<UserNotification[]>{
 const user=await currentUser();const {data,error}=await supabase.from('user_notifications').select('id,category,title,body,route,metadata,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as UserNotification[];
}
export async function markNotificationRead(id:string){const user=await currentUser();const {error}=await supabase.from('user_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);if(error)throw error}
export async function markAllNotificationsRead(){const user=await currentUser();const {error}=await supabase.from('user_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);if(error)throw error}
