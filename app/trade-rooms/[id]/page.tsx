"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const RoomView = dynamic(() => import("./RoomView"), { ssr: false });

export default function TradeRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoomView roomId={Number(id)} />;
}
