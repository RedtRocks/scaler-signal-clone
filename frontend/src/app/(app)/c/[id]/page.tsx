import { notFound } from "next/navigation";
import { ChatScreen } from "@/features/chat/ChatScreen";

export default async function ChatPage({ params }: PageProps<"/c/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <ChatScreen conversationId={id} key={id} />;
}
