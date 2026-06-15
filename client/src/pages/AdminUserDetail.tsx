import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowLeft,
  Ban,
  BookOpen,
  CheckCircle,
  Flame,
  RotateCcw,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { formatDateEU } from "@/lib/utils";
import { useState } from "react";
import { EnergyGrantPanel } from "@/components/admin/EnergyGrantPanel";

interface Props {
  userId: string;
}

export default function AdminUserDetail({ userId }: Props) {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const userDetail = useQuery(api.admin.getUserById, { userId: userId as any });

  const updateRoleMutation = useMutation(api.admin.updateUserRole);
  const toggleStatusMutation = useMutation(api.admin.toggleUserStatus);
  const toggleBetaTesterMutation = useMutation(api.admin.toggleBetaTester);
  const setFeatureTierOverrideMutation = useMutation(api.admin.setFeatureTierOverride);
  const deleteUserAction = useAction(api.admin.deleteUser);
  const resetProgressMutation = useMutation(api.admin.resetUserProgress);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
    variant?: 'default' | 'destructive';
  } | null>(null);

  const isLoading = authLoading || userDetail === undefined;
  const isSuperadmin = currentUser?.role === 'superadmin';

  const handleRoleChange = async (newRole: 'superadmin' | 'admin' | 'student') => {
    try {
      await updateRoleMutation({ userId: userId as any, role: newRole });
      toast.success('Role updated successfully');
    } catch {
      toast.error('Failed to update role');
    }
  };

  const requestRoleChange = (newRole: 'superadmin' | 'admin' | 'student') => {
    if (!userDetail) return;
    setConfirmDialog({
      open: true,
      title: 'Change User Role',
      description: `Change the role for "${userDetail.name || userDetail.email}" from "${userDetail.role}" to "${newRole}"?`,
      onConfirm: () => handleRoleChange(newRole),
    });
  };

  const handleToggleStatus = async () => {
    if (!userDetail) return;
    try {
      await toggleStatusMutation({ userId: userId as any, isActive: !userDetail.isActive });
      toast.success(userDetail.isActive ? 'User deactivated' : 'User activated');
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const requestToggleStatus = () => {
    if (!userDetail) return;
    setConfirmDialog({
      open: true,
      title: userDetail.isActive ? 'Deactivate Account' : 'Activate Account',
      description: userDetail.isActive
        ? `Deactivate the account for "${userDetail.name || userDetail.email}"? The user will no longer be able to log in.`
        : `Activate the account for "${userDetail.name || userDetail.email}"?`,
      onConfirm: handleToggleStatus,
      variant: userDetail.isActive ? 'destructive' : 'default',
    });
  };

  const handleToggleBetaTester = async () => {
    if (!userDetail) return;
    try {
      await toggleBetaTesterMutation({ userId: userId as any, isBetaTester: !userDetail.isBetaTester });
      toast.success(userDetail.isBetaTester ? 'Beta tester badge removed' : 'Beta tester badge added');
    } catch {
      toast.error('Failed to update beta tester status');
    }
  };

  const requestToggleBetaTester = () => {
    if (!userDetail) return;
    setConfirmDialog({
      open: true,
      title: userDetail.isBetaTester ? 'Remove Beta Badge' : 'Add Beta Badge',
      description: userDetail.isBetaTester
        ? `Remove the Beta Tester badge from "${userDetail.name || userDetail.email}"?`
        : `Add the Beta Tester badge to "${userDetail.name || userDetail.email}"?`,
      onConfirm: handleToggleBetaTester,
    });
  };

  const handleSetTierOverride = async (value: string) => {
    const tier = value === "none" ? null : (value as "course" | "buddy" | "basic" | "full");
    try {
      await setFeatureTierOverrideMutation({ userId: userId as any, featureTier: tier });
      toast.success(tier ? `Feature tier override set to "${tier}"` : "Feature tier override cleared");
    } catch {
      toast.error("Failed to update feature tier override");
    }
  };

  const requestSetTierOverride = (value: string) => {
    if (!userDetail) return;
    const tier = value === "none" ? null : value;
    setConfirmDialog({
      open: true,
      title: "Set Feature Tier Override",
      description: tier
        ? `Force the "${tier}" feature package for "${userDetail.name || userDetail.email}"? This overrides their subscription/beta access (energy still limited).`
        : `Clear the feature tier override for "${userDetail.name || userDetail.email}"? They fall back to their subscription/beta access.`,
      onConfirm: () => handleSetTierOverride(value),
    });
  };

  const handleResetProgress = async () => {
    try {
      await resetProgressMutation({ userId: userId as any });
      toast.success('Progress reset successfully');
    } catch {
      toast.error('Failed to reset progress');
    }
  };

  const requestResetProgress = () => {
    if (!userDetail) return;
    setConfirmDialog({
      open: true,
      title: 'Reset Learning Progress',
      description: `Reset all learning progress for "${userDetail.name || userDetail.email}" back to Unit 1? All completed units, XP, and streaks will be lost. This cannot be undone.`,
      onConfirm: handleResetProgress,
      variant: 'destructive',
    });
  };

  const handleDeleteUser = async () => {
    const targetEmail = (userDetail?.email ?? "").trim().toLowerCase();
    const typed = deleteEmailInput.trim().toLowerCase();
    if (!targetEmail || typed !== targetEmail) {
      toast.error('Email confirmation does not match. Deletion aborted.');
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteUserAction({ userId: userId as any });

      if (!result.success) {
        toast.error(
          result.warning || 'Clerk deletion failed - user not removed.',
          {
            duration: 10000,
            description: result.clerkErrorMessage || undefined,
          }
        );
        return;
      }

      const rowsSummary = `Removed ${result.totalRows} database rows across ${Object.keys(result.deleted).length} tables.`;

      if (result.warning) {
        toast.warning(result.warning, {
          duration: 10000,
          description: rowsSummary,
        });
      } else if (result.clerkDeletionStatus === 'already_gone') {
        toast.success('User removed from Convex (Clerk record was already gone).', {
          description: rowsSummary,
        });
      } else if (result.clerkDeletionStatus === 'no_clerk_id') {
        toast.success('User removed from Convex (no linked Clerk account).', {
          description: rowsSummary,
        });
      } else {
        toast.success('User fully deleted from Clerk and Convex.', {
          description: rowsSummary,
        });
      }
      setDeleteDialogOpen(false);
      setDeleteEmailInput("");
      navigate('/admin');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
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

  if (!userDetail) {
    return (
      <div className="container py-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to User Management
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">User not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { progress, subscription } = userDetail as any;
  const isSelf = currentUser._id === userDetail._id;

  return (
    <div className="container py-8 max-w-4xl">
      {/* Back navigation */}
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to User Management
        </Button>
      </Link>

      {/* User Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 shrink-0 border">
                <AvatarImage src={(userDetail as any).avatarUrl || undefined} alt={userDetail.name || "User"} />
                <AvatarFallback className="text-base font-semibold">
                  {(userDetail.name || userDetail.email || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{userDetail.name || 'Unnamed User'}</CardTitle>
                {(userDetail as any).publicNickname && (
                  <p className="text-sm text-muted-foreground">{(userDetail as any).publicNickname}</p>
                )}
                <CardDescription className="mt-1">{userDetail.email || 'No email'}</CardDescription>
                {userDetail.clerkId && (
                  <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{userDetail.clerkId}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                userDetail.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                userDetail.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {userDetail.role}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                userDetail.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {userDetail.isActive ? 'Active' : 'Inactive'}
              </span>
              {userDetail.isBetaTester && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Beta
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Registered</p>
              <p className="font-medium">{userDetail._creationTime ? formatDateEU(userDetail._creationTime) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Last Login</p>
              <p className="font-medium">{userDetail.lastActiveDate ? formatDateEU(userDetail.lastActiveDate) : 'Never'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Subscription</p>
              <p className="font-medium">{subscription?.planName || 'None'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Learning Language</p>
              <p className="font-medium">{userDetail.learningLanguage?.toUpperCase() || 'EN'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Profile Settings</CardTitle>
          <CardDescription>User-configured preferences stored in the database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Nickname</p>
              <p className="font-medium">{(userDetail as any).publicNickname || <span className="text-muted-foreground italic">Not set</span>}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Public Profile</p>
              <p className="font-medium">
                {(userDetail as any).leaderboardPublicEnabled
                  ? <span className="text-green-600">Enabled</span>
                  : <span className="text-muted-foreground">Disabled</span>
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Community Emails</p>
              <p className="font-medium">
                {(userDetail as any).newsletterStatus?.subscribed
                  ? <span className="text-green-600">Subscribed</span>
                  : (userDetail as any).newsletterStatus?.pending
                    ? <span className="text-yellow-600">Pending confirmation</span>
                    : <span className="text-muted-foreground">Not subscribed</span>
                }
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Onboarding and session preferences are stored locally on the user's device and cannot be viewed here.
          </p>
        </CardContent>
      </Card>

      {/* Gamification Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userDetail.level ?? 1}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userDetail.totalXP ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userDetail.currentStreak ?? 0}</div>
            <p className="text-xs text-muted-foreground">Longest: {userDetail.longestStreak ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Done</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress?.completedUnits?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Student Progress */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Learning Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {progress ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Current Unit</p>
                <p className="font-medium">Unit {progress.currentUnit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Completed Units</p>
                <p className="font-medium">{progress.completedUnits?.length ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Learning Duration</p>
                <p className="font-medium">{progress.learningDuration ? `${progress.learningDuration} weeks` : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Last Activity</p>
                <p className="font-medium">
                  {progress.lastActivityAt ? formatDateEU(progress.lastActivityAt) : 'Never'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No learning progress recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions – Superadmin only, cannot act on self */}
      {isSuperadmin && !isSelf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Administrative actions for this user account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Role</p>
                <p className="text-xs text-muted-foreground">Change the user's access level</p>
              </div>
              <Select
                value={userDetail.role}
                onValueChange={(value) => requestRoleChange(value as any)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t" />

            {/* Status toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Account Status</p>
                <p className="text-xs text-muted-foreground">
                  Currently: <span className={userDetail.isActive ? 'text-green-600' : 'text-red-600'}>
                    {userDetail.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={requestToggleStatus} className="gap-2">
                {userDetail.isActive ? (
                  <><Ban className="h-4 w-4" /> Deactivate</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Activate</>
                )}
              </Button>
            </div>

            <div className="border-t" />

            {/* Beta tester toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Beta Tester</p>
                <p className="text-xs text-muted-foreground">
                  Currently: {userDetail.isBetaTester ? 'Yes' : 'No'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={requestToggleBetaTester}>
                {userDetail.isBetaTester ? 'Remove Beta Badge' : 'Add Beta Badge'}
              </Button>
            </div>

            <div className="border-t" />

            {/* Feature tier override */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Feature Tier Override</p>
                <p className="text-xs text-muted-foreground">
                  Forces a package for testing/support. Overrides subscription &amp; beta.
                </p>
              </div>
              <Select
                value={(userDetail as any).featureTierOverride ?? 'none'}
                onValueChange={(value) => requestSetTierOverride(value)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No override</SelectItem>
                  <SelectItem value="course">Sprachkurs (course)</SelectItem>
                  <SelectItem value="buddy">AI Buddy (buddy)</SelectItem>
                  <SelectItem value="basic">Basic Kombi (basic)</SelectItem>
                  <SelectItem value="full">Full Package (full)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t" />

            {/* AI Energy state + grant (superadmin can grant) */}
            <EnergyGrantPanel
              userId={userId as Id<"users">}
              subscription={userDetail.subscription as any}
              isSuperadmin={isSuperadmin}
            />

            {/* Reset progress – students only */}
            {userDetail.role === 'student' && (
              <>
                <div className="border-t" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Reset Progress</p>
                    <p className="text-xs text-muted-foreground">Resets all learning progress to Unit 1</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={requestResetProgress} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </>
            )}

            <div className="border-t" />

            {/* Delete */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently removes user and all their data</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteEmailInput("");
                  setDeleteDialogOpen(true);
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generic confirmation dialog */}
      <AlertDialog
        open={confirmDialog?.open ?? false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmDialog?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteDialogOpen(open);
          if (!open) setDeleteEmailInput("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account for{" "}
              <strong>{userDetail.name || userDetail.email}</strong> and all
              associated data (progress, vocabulary, chat history, feedback,
              subscriptions). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="admin-delete-confirm-email">
              To confirm, type the user&apos;s full email address:{" "}
              <strong className="break-all">{userDetail.email || "(no email on record)"}</strong>
            </Label>
            <Input
              id="admin-delete-confirm-email"
              type="email"
              autoComplete="off"
              value={deleteEmailInput}
              onChange={(e) => setDeleteEmailInput(e.target.value)}
              placeholder={userDetail.email || "user@example.com"}
              disabled={deleting || !userDetail.email}
            />
            {!userDetail.email && (
              <p className="text-xs text-destructive">
                This user has no email on record, so deletion via this dialog is disabled.
                Please handle this account manually.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteUser();
              }}
              disabled={
                deleting ||
                !userDetail.email ||
                deleteEmailInput.trim().toLowerCase() !==
                  (userDetail.email ?? "").trim().toLowerCase()
              }
            >
              {deleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
