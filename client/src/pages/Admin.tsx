import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Users, UserPlus, Activity, ArrowUpDown, Copy, ExternalLink, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateEU } from "@/lib/utils";
import { useState, useMemo } from "react";


export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const users = useQuery(api.admin.getAllUsers);
  const since24h = useMemo(() => Date.now() - 86400 * 1000, []);
  const stats24h = useQuery(api.admin.get24hStats, { since: since24h });

  const usersLoading = users === undefined;
  const statsLoading = stats24h === undefined;

  const [sortField, setSortField] = useState<string>('_creationTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopyClerkId = async (clerkId: string) => {
    try {
      if (!clerkId) return;
      await navigator.clipboard.writeText(clerkId);
      toast("Clerk ID copied to clipboard");
    } catch {
      toast.error("Failed to copy Clerk ID");
    }
  };

  const handleOpenClerkDashboard = () => {
    window.open("https://dashboard.clerk.com", "_blank", "noopener,noreferrer");
  };

  if (authLoading || usersLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">You don't have permission to access this page.</p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* 24h Statistics */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats24h?.totalUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Registrations</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats24h?.registrationsLast24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats24h?.activeUsersLast24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* User Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            User Management
            <span className="text-sm font-normal text-muted-foreground">({stats24h?.totalUsers ?? 0} Total Users)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('name')} className="h-8 px-2">
                      Name <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('clerkId')} className="h-8 px-2">
                      ID <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('email')} className="h-8 px-2">
                      Email <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('lastActiveDate')} className="h-8 px-2">
                      Last Login <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('_creationTime')} className="h-8 px-2">
                      Registered <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((u: any) => (
                  <TableRow key={u._id}>
                    <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                    <TableCell>
                      {u.clerkId ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="max-w-[160px] truncate font-mono" title={String(u.clerkId)}>
                            {u.clerkId}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleCopyClerkId(String(u.clerkId))}
                            title="Copy Clerk ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={handleOpenClerkDashboard}
                            title="Open Clerk Dashboard"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{u.email || 'N/A'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.lastActiveDate ? formatDateEU(u.lastActiveDate) : 'Never'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u._creationTime ? formatDateEU(u._creationTime) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/users/${u._id}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          Details <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
