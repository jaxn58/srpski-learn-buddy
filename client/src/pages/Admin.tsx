import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Users, TrendingUp, BookOpen, Activity, MoreVertical, Trash2, Ban, CheckCircle, RotateCcw, MessageSquare, UserPlus, Mail, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";


export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const users = useQuery(api.admin.getAllUsers);
  const allProgress = useQuery(api.admin.getAllProgress);
  const stats = useQuery(api.admin.getStatistics);
  const usersLoading = users === undefined;
  const progressLoading = allProgress === undefined;
  const statsLoading = stats === undefined;
  
  const updateRoleMutation = useMutation(api.admin.updateUserRole);
  const toggleStatusMutation = useMutation(api.admin.toggleUserStatus);
  const toggleBetaTesterMutation = useMutation(api.admin.toggleBetaTester);
  const deleteUserMutation = useMutation(api.admin.deleteUser);
  const resetProgressMutation = useMutation(api.admin.resetUserProgress);
  
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  // Sorting state for users table
  const [usersSortField, setUsersSortField] = useState<string>('name');
  const [usersSortDirection, setUsersSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Sorting state for progress table
  const [progressSortField, setProgressSortField] = useState<string>('userName');
  const [progressSortDirection, setProgressSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Sort users
  const sortedUsers = useMemo(() => {
    if (!users) return [];
    const sorted = [...users].sort((a: any, b: any) => {
      let aVal = a[usersSortField];
      let bVal = b[usersSortField];
      
      if (usersSortField === 'subscription') {
        aVal = a.subscription?.planName || 'None';
        bVal = b.subscription?.planName || 'None';
      }
      
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return usersSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return usersSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [users, usersSortField, usersSortDirection]);
  
  // Sort progress
  const sortedProgress = useMemo(() => {
    if (!allProgress) return [];
    const filtered = allProgress.filter((p: any) => {
      const user = users?.find((u: any) => u._id === p.userId);
      return user?.role === 'student';
    });
    
    const sorted = [...filtered].sort((a: any, b: any) => {
      let aVal = a[progressSortField];
      let bVal = b[progressSortField];
      
      if (progressSortField === 'completedUnits') {
        aVal = a.completedUnits?.length || 0;
        bVal = b.completedUnits?.length || 0;
      }
      
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return progressSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return progressSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allProgress, users, progressSortField, progressSortDirection]);
  
  const toggleUserSort = (field: string) => {
    if (usersSortField === field) {
      setUsersSortDirection(usersSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUsersSortField(field);
      setUsersSortDirection('asc');
    }
  };
  
  const toggleProgressSort = (field: string) => {
    if (progressSortField === field) {
      setProgressSortDirection(progressSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setProgressSortField(field);
      setProgressSortDirection('asc');
    }
  };

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
    try {
      await updateRoleMutation({ userId: userId as any, role: newRole });
      toast.success('Role updated successfully');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleStatusMutation({ userId: userId as any, isActive: !currentStatus });
      toast.success(currentStatus ? 'User deactivated' : 'User activated');
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleToggleBetaTester = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleBetaTesterMutation({ userId: userId as any, isBetaTester: !currentStatus });
      toast.success(currentStatus ? 'Beta tester badge removed' : 'Beta tester badge added');
    } catch (error) {
      toast.error('Failed to update beta tester status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const result = await deleteUserMutation({ userId: userId as any });
      
      if (result?.warning) {
        toast.warning(result.warning, {
          duration: 8000,
          description: 'To fully delete the user, also remove them from the Clerk Dashboard.',
        });
      } else {
        toast.success('User deleted successfully from both Clerk and Convex');
      }
      
      setDeletingUserId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      console.error('Delete user error:', error);
    }
  };

  const handleResetProgress = async (userId: string) => {
    try {
      await resetProgressMutation({ userId: userId as any });
      toast.success('Progress reset successfully');
    } catch (error) {
      toast.error('Failed to reset progress');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <main className="container py-8">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeUsers || 0} von {stats?.totalUsers || 0} active</div>
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
              <div className="text-2xl font-bold">{stats?.avgCompletedUnits || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              User Management 
              <span className="text-sm font-normal text-muted-foreground">({stats?.totalUsers || 0} Total Users)</span>
              {user.role === 'admin' && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">👁️ Read-Only</span>
              )}
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions
              {user.role === 'admin' && " (View only - no edit permissions)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('name')} className="h-8 px-2">
                      Name <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('email')} className="h-8 px-2">
                      Email <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('role')} className="h-8 px-2">
                      Role <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('isActive')} className="h-8 px-2">
                      Status <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('isBetaTester')} className="h-8 px-2">
                      Beta Tester <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('subscription')} className="h-8 px-2">
                      Subscription <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserSort('_lastModified')} className="h-8 px-2">
                      Last Signed In <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers?.map((u: any) => (
                  <TableRow key={u._id}>
                    <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                    <TableCell>{u.email || 'N/A'}</TableCell>
                    <TableCell>
                      {user.role === 'superadmin' && u._id !== user._id ? (
                        <Select
                          value={u.role}
                          onValueChange={(value) => handleRoleChange(u._id, value as any)}
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
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.isBetaTester ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ✨ Beta
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.subscription ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {u.subscription.planName || u.subscription.planType}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u._lastModified ? new Date(u._lastModified).toLocaleDateString('de-DE') : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.role === 'superadmin' && u._id !== user._id ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStatus(u._id, u.isActive)}>
                              {u.isActive ? (
                                <>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Deactivate User
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Activate User
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleBetaTester(u._id, u.isBetaTester)}>
                              {u.isBetaTester ? (
                                <>
                                  ✨ Remove Beta Badge
                                </>
                              ) : (
                                <>
                                  ✨ Add Beta Badge
                                </>
                              )}
                            </DropdownMenuItem>
                            {u.role === 'student' && (
                              <DropdownMenuItem onClick={() => handleResetProgress(u._id)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset Progress
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  "This will permanently delete the user account and all associated data (progress, vocabulary, chat history). Are you sure?"
                                );
                                if (!confirmed) return;
                                await handleDeleteUser(u._id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('userName')} className="h-8 px-2">
                      Student <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('userEmail')} className="h-8 px-2">
                      Email <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('currentWeek')} className="h-8 px-2">
                      Current Week <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('currentUnit')} className="h-8 px-2">
                      Current Unit <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('completedUnits')} className="h-8 px-2">
                      Completed Units <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('learningDuration')} className="h-8 px-2">
                      Duration <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleProgressSort('lastActivityAt')} className="h-8 px-2">
                      Last Activity <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProgress?.map((p: any) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.userName}</TableCell>
                    <TableCell>{p.userEmail}</TableCell>
                    <TableCell>Week {p.currentWeek}</TableCell>
                    <TableCell>Unit {p.currentUnit}</TableCell>
                    <TableCell>{p.completedUnits?.length || 0} / 27</TableCell>
                    <TableCell>{p.learningDuration} weeks</TableCell>
                    <TableCell>
                      {p.lastActivityAt 
                        ? new Date(p.lastActivityAt).toLocaleDateString('de-DE')
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
    </div>
  );
}
