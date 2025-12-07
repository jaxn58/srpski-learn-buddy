import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Users, Eye, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";


export default function BetaRegistrations() {
  const { user, loading: authLoading } = useAuth();
  const registrations = useQuery(api.beta.getAll);
  const registrationsLoading = registrations === undefined;
  
  const updateStatusMutation = useMutation(api.beta.updateStatus);
  const deleteRegistrationMutation = useMutation(api.beta.deleteRegistration);
  
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (authLoading || registrationsLoading) {
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

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatusMutation({
        id: id as any,
        status: status as any,
      });
      toast.success(`Registration ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;
    
    try {
      await deleteRegistrationMutation({ id: id as any });
      toast.success('Registration deleted successfully');
    } catch (error) {
      toast.error('Failed to delete registration');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRegistrations = registrations?.filter(reg => 
    statusFilter === 'all' || reg.status === statusFilter
  ) || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-card">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Beta Registrations</h1>
              </div>
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  Back to Admin Panel
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="container py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Beta Testing Applications
                  {user.role === 'admin' && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">👁️ Read-Only</span>
                  )}
                </CardTitle>
                <CardDescription>
                  Review and manage beta tester registrations
                  {user.role === 'admin' && ' (View only - no edit permissions)'}
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No registrations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((registration) => (
                    <TableRow key={registration._id}>
                      <TableCell className="font-medium">{registration.name}</TableCell>
                      <TableCell>{registration.email}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(registration.status)}>
                          {registration.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {registration._creationTime ? new Date(registration._creationTime).toLocaleDateString('de-DE') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRegistration(registration)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{registration.name}</DialogTitle>
                                <DialogDescription>
                                  Registered on {registration.registeredAt ? new Date(registration.registeredAt).toLocaleString('de-DE') : 'N/A'}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="space-y-4">
                                <div>
                                  <h3 className="font-semibold mb-2">Email</h3>
                                  <p className="text-sm text-muted-foreground">{registration.email}</p>
                                </div>

                                <div>
                                  <h3 className="font-semibold mb-2">Motivation</h3>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {registration.motivation || "No motivation provided"}
                                  </p>
                                </div>

                                <div>
                                  <h3 className="font-semibold mb-2">Status</h3>
                                  <Badge className={getStatusColor(registration.status)}>
                                    {registration.status}
                                  </Badge>
                                </div>

                                {user.role === 'superadmin' ? (
                                  registration.status === 'pending' && (
                                    <div className="flex gap-2 pt-4">
                                      <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={() => handleStatusChange(registration._id, 'approved')}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Approve
                                      </Button>
                                      <Button
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                        onClick={() => handleStatusChange(registration._id, 'rejected')}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject
                                      </Button>
                                    </div>
                                  )
                                ) : (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">👁️ <strong>Read-Only Mode:</strong> You can view registrations but cannot approve or reject.</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          {user.role === 'superadmin' && (
                            <>
                              {registration.status === 'pending' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleStatusChange(registration._id, 'approved')}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleStatusChange(registration._id, 'rejected')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(registration._id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </main>
      </div>
    </div>
  );
}

