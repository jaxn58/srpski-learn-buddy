import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { Send, User, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import ReactMarkdown from 'react-markdown';
import { Sidebar } from "@/components/Sidebar";

// Custom Markdown components for clean rendering
const markdownComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
  li: ({node, ...props}: any) => <li className="mb-0" {...props} />,
  code: ({node, inline, ...props}: any) => 
    inline ? 
      <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props} /> :
      <code className="block bg-black/20 p-2 rounded text-xs font-mono overflow-x-auto mb-2" {...props} />,
  pre: ({node, ...props}: any) => <pre className="bg-black/20 p-2 rounded overflow-x-auto mb-2" {...props} />,
  table: ({node, ...props}: any) => <table className="w-full text-xs border-collapse mb-2 border border-black/20" {...props} />,
  thead: ({node, ...props}: any) => <thead className="border-b border-black/20 bg-black/10" {...props} />,
  tbody: ({node, ...props}: any) => <tbody {...props} />,
  tr: ({node, ...props}: any) => <tr className="border-b border-black/20" {...props} />,
  th: ({node, ...props}: any) => <th className="text-left font-semibold p-2" {...props} />,
  td: ({node, ...props}: any) => <td className="p-2" {...props} />,
  blockquote: ({node, ...props}: any) => <blockquote className="border-l-2 border-black/30 pl-2 italic mb-2" {...props} />,
  h1: ({node, ...props}: any) => <h1 className="text-lg font-bold mb-2" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-base font-bold mb-2" {...props} />,
  h3: ({node, ...props}: any) => <h3 className="text-sm font-bold mb-2" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-bold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
};

export default function Chat() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: history } = trpc.chat.getHistory.useQuery({ limit: 50 });
  const { data: progress } = trpc.progress.get.useQuery();
  const sendMutation = trpc.chat.sendMessage.useMutation();

  useEffect(() => {
    if (history) {
      setMessages(history.reverse());
    }
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sendMutation.isPending) return;

    const userMessage = { role: "user", content: message, createdAt: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setMessage("");

    try {
      const response = await sendMutation.mutateAsync({
        message,
        unitContext: progress?.currentUnit,
      });

      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.message,
        createdAt: new Date(),
      }]);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Sidebar />
      <div className="flex-1">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← Back</Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">AI Professor</h1>
                <p className="text-xs text-muted-foreground">Your Serbian language tutor</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-4xl">
        <div className="h-[calc(100vh-180px)] flex flex-col bg-card rounded-lg shadow-lg border">
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Start Learning Serbian!</h2>
                  <p className="text-muted-foreground mb-4">Ask me anything about grammar, vocabulary, or practice conversation</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("Explain the verb 'biti' to me")}>
                    <p className="text-sm font-medium">Explain verb 'biti'</p>
                  </Card>
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("What is the locative case?")}>
                    <p className="text-sm font-medium">Locative case</p>
                  </Card>
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("Dobar dan! Kako ste?")}>
                    <p className="text-sm font-medium">Practice conversation</p>
                  </Card>
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className={`h-8 w-8 flex-shrink-0 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-primary'}`}>
                  <AvatarFallback className="text-white text-xs">
                    {msg.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="space-y-0">
                        <ReactMarkdown components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 px-2">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                  <AvatarFallback className="text-white text-xs">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-muted/30">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Press Enter to send)"
                className="flex-1 rounded-full"
                disabled={sendMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                size="icon"
                className="rounded-full h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

