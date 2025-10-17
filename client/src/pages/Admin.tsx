import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Users, TrendingUp, BookOpen, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { data: users, isLoading: usersLoading } = trpc.admin.getAllUsers.useQuery();
  const { data: progress, isLoading: progressLoading } = trpc.admin.getAllProgress.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.admin.getStatistics.useQuery();
  const updateRole = trpc.admin.updateUserRole.useMutation();
  const utils = trpc.useUtils();

  if (authLoading || usersLoading || progressLoading || statsLoading) {
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
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRoleChange = async (userId: string, newRole: 'superadmin' | 'admin' | 'student') => {
    await updateRole.mutateAsync({ userId, role: newRole });
    utils.admin.getAllUsers.invalidate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name} ({user.role})
              </span>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Back to Learning</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Statistics Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalLessonsCompleted || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.averageProgress || 0}%</div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user roles and permissions
              {user.role === 'admin' && " (Students only)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Signed In</TableHead>
                  {user.role === 'superadmin' && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                    <TableCell>{u.email || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : 'Never'}
                    </TableCell>
                    {user.role === 'superadmin' && (
                      <TableCell>
                        {u.id !== user.id && (
                          <Select
                            value={u.role}
                            onValueChange={(value) => handleRoleChange(u.id, value as any)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Student Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Student Progress</CardTitle>
            <CardDescription>Overview of all student learning progress</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Week</TableHead>
                  <TableHead>Current Unit</TableHead>
                  <TableHead>Completed Units</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress?.filter(p => p.userRole === 'student').map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.userName}</TableCell>
                    <TableCell>{p.userEmail}</TableCell>
                    <TableCell>Week {p.currentWeek}</TableCell>
                    <TableCell>Unit {p.currentUnit}</TableCell>
                    <TableCell>{p.completedUnits?.length || 0} / 27</TableCell>
                    <TableCell>{p.learningDuration} weeks</TableCell>
                    <TableCell>
                      {p.lastActivityAt 
                        ? new Date(p.lastActivityAt).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
