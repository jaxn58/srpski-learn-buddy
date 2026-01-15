import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Mail, Users, CheckCircle, Clock, Bell, Loader2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDateEU, formatDateTimeEU } from "@/lib/utils";

type WaitlistEntry = Doc<"waitlist">;

export default function AdminWaitlist() {
  const { user, loading: authLoading } = useAuth();
  const waitlistEntries = useQuery(api.waitlist.getAll) as WaitlistEntry[] | undefined;
  const stats = useQuery(api.waitlist.getStats);
  const notifyAllMutation = useMutation(api.waitlist.notifyAll);
  const removeMutation = useMutation(api.waitlist.remove);

  const [isNotifying, setIsNotifying] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"waitlist"> | null>(null);

  // Check if user is admin
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleNotifyAll = async () => {
    setIsNotifying(true);
    try {
      const result = await notifyAllMutation();
      toast.success(
        `Successfully notified ${result.successCount} users! ${result.errorCount > 0 ? `${result.errorCount} failed.` : ""}`
      );
    } catch (error: any) {
      console.error("[AdminWaitlist] Error notifying users:", error);
      toast.error(error.message || "Failed to notify users");
    } finally {
      setIsNotifying(false);
    }
  };

  const handleDelete = async (waitlistId: Id<"waitlist">, email: string) => {
    setDeletingId(waitlistId);
    try {
      await removeMutation({ waitlistId });
      toast.success(`Successfully deleted ${email}`);
    } catch (error: any) {
      console.error("[AdminWaitlist] Error deleting entry:", error);
      toast.error(error.message || "Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (!waitlistEntries || waitlistEntries.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Email", "Name", "Status", "Wants Waitlist Updates", "Created At", "Confirmed At", "Notified At"];
    const rows = waitlistEntries.map((entry) => [
      entry.email,
      entry.name || "",
      entry.status,
      entry.wantsWaitlistUpdates ? "yes" : "no",
      formatDateTimeEU(entry.createdAt),
      entry.confirmedAt ? formatDateTimeEU(entry.confirmedAt) : "",
      entry.notifiedAt ? formatDateTimeEU(entry.notifiedAt) : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `waitlist_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV exported successfully");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "notified":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><Bell className="h-3 w-3 mr-1" />Notified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const confirmedCount = stats?.confirmed || 0;
  const hasConfirmedUsers = confirmedCount > 0;

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waitlist Management</h1>
          <p className="text-muted-foreground">Manage users waiting for Beta launch</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!waitlistEntries || waitlistEntries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!hasConfirmedUsers || isNotifying}
                className="bg-primary hover:bg-primary/90"
              >
                {isNotifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Notifying...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Notify All ({confirmedCount})
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Notify All Confirmed Users?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will send the Beta Launch email to all {confirmedCount} confirmed users on the waitlist.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleNotifyAll}>
                  Send Emails
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All waitlist entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.confirmed || 0}</div>
            <p className="text-xs text-muted-foreground">Ready to notify</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notified</CardTitle>
            <Bell className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.notified || 0}</div>
            <p className="text-xs text-muted-foreground">Beta launch sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Waitlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>Waitlist Entries</CardTitle>
          <CardDescription>All users who have registered for the waitlist</CardDescription>
        </CardHeader>
        <CardContent>
          {!waitlistEntries ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : waitlistEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No waitlist entries yet</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updates</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Notified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlistEntries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell className="font-medium">{entry.email}</TableCell>
                      <TableCell>{entry.name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell>
                        {entry.wantsWaitlistUpdates ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateEU(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.confirmedAt ? formatDateEU(entry.confirmedAt) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.notifiedAt ? formatDateEU(entry.notifiedAt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === entry._id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingId === entry._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Waitlist Entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{entry.email}</strong> from the waitlist?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(entry._id, entry.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Yes, Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
