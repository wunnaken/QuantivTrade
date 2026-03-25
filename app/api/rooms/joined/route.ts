import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const dynamic = 'force-dynamic';

export async function GET() {
  const routeClient = await createRouteHandlerClient();
  const { data: { user } } = await routeClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ rooms: [] });
  const authUid = user.id;

  const supabase = createServerClient();

  const { data: memberRows } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', authUid);

  const roomIds = (memberRows ?? []).map((r) => r.room_id);
  if (!roomIds.length) return NextResponse.json({ rooms: [] });

  const { data: roomRows } = await supabase
    .from('rooms')
    .select('*')
    .in('id', roomIds)
    .order('created_at', { ascending: false });

  if (!roomRows?.length) return NextResponse.json({ rooms: [] });

  const { data: countRows } = await supabase
    .from('room_members')
    .select('room_id')
    .in('room_id', roomIds);

  const countMap: Record<number, number> = {};
  (countRows ?? []).forEach((r: { room_id: number }) => {
    countMap[r.room_id] = (countMap[r.room_id] ?? 0) + 1;
  });

  const hostIds = [...new Set(roomRows.map((r) => r.host_user_id))];
  const { data: hostProfiles } = await supabase
    .from('profiles')
    .select('id, username, name')
    .in('id', hostIds);

  const hostMap: Record<number, string | null> = {};
  (hostProfiles ?? []).forEach((p: { id: number; username: string | null; name: string | null }) => {
    hostMap[p.id] = p.username || p.name || null;
  });

  const rooms = roomRows.map((r) => ({
    ...r,
    member_count: countMap[r.id] ?? 0,
    host_username: hostMap[r.host_user_id] ?? null,
  }));

  return NextResponse.json({ rooms });
}
