import { Suspense } from "react";
import { ChatThread } from "@/components/chat/chat-thread";

// useSearchParams (for ?c=<conversation>) needs a Suspense boundary above it.
export default function AskPage() {
  return <Suspense><ChatThread /></Suspense>;
}
