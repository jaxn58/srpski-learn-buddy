import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, MessageSquare, UserCheck, Shield } from "lucide-react";

export function AdminHeader() {
  const { user } = useAuth();

  // Only show for admin and superadmin roles
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return null;
  }

  const isReadOnly = user.role === 'admin';

  return (
    <div className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b border-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">
            {isReadOnly ? '👁️ Admin (Read-Only)' : '⚙️ Superadmin'}
          </span>
        </div>

        <div className="border-l border-border pl-4 flex items-center gap-1">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">User Management</span>
            </Button>
          </Link>

          <Link href="/admin/feedback">
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Feedback</span>
            </Button>
          </Link>

          <Link href="/admin/beta-registrations">
            <Button variant="ghost" size="sm" className="gap-2">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Beta</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

