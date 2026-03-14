"use client";

import { useRouter } from "next/navigation";
import { WelcomeAnimation } from "../../components/WelcomeAnimation";

/**
 * Preview the welcome animation (e.g. after already having an account).
 * Visit /welcome-preview to watch it again. Does not set the "welcomed" flag.
 */
export default function WelcomePreviewPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push("/feed");
  };

  return <WelcomeAnimation onComplete={handleComplete} />;
}
