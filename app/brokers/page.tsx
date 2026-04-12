"use client";
import dynamic from "next/dynamic";

const BrokersView = dynamic(() => import("./BrokersView"), { ssr: false });

export default function BrokersPage() {
  return <BrokersView />;
}
