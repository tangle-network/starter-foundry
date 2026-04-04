'use client'

import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { ColumnHeader } from '@/components/admin/column-header'
import { EntityForm, type FieldDef } from '@/components/admin/entity-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'viewer'
  status: 'active' | 'inactive' | 'suspended'
  createdAt: string
}

const users: User[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@example.com', role: 'admin', status: 'active', createdAt: '2024-01-15' },
  { id: '2', name: 'Marcus Johnson', email: 'marcus@example.com', role: 'user', status: 'active', createdAt: '2024-02-03' },
  { id: '3', name: 'Emily Rodriguez', email: 'emily@example.com', role: 'user', status: 'inactive', createdAt: '2024-02-18' },
  { id: '4', name: 'David Kim', email: 'david@example.com', role: 'viewer', status: 'active', createdAt: '2024-03-07' },
  { id: '5', name: 'Lisa Wang', email: 'lisa@example.com', role: 'admin', status: 'active', createdAt: '2024-03-22' },
  { id: '6', name: 'James Wilson', email: 'james@example.com', role: 'user', status: 'suspended', createdAt: '2024-04-01' },
  { id: '7', name: 'Ana Petrov', email: 'ana@example.com', role: 'viewer', status: 'active', createdAt: '2024-04-14' },
  { id: '8', name: 'Tom Baker', email: 'tom@example.com', role: 'user', status: 'active', createdAt: '2024-05-02' },
  { id: '9', name: 'Priya Sharma', email: 'priya@example.com', role: 'admin', status: 'inactive', createdAt: '2024-05-19' },
  { id: '10', name: 'Carlos Mendez', email: 'carlos@example.com', role: 'user', status: 'active', createdAt: '2024-06-08' },
]

const statusVariant: Record<User['status'], 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
}

const formFields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'role', label: 'Role', type: 'select', options: ['admin', 'user', 'viewer'] },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'suspended'] },
]

export default function AdminPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <ColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <ColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <ColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <span className="capitalize">{row.getValue<string>('role')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue<User['status']>('status')
        return <Badge variant={statusVariant[status]}>{status}</Badge>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <ColumnHeader column={column} title="Created" />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditUser(row.original); setFormOpen(true) }}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions.</p>
        </div>
        <Button onClick={() => { setEditUser(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Add user
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchKey="email"
        onBulkDelete={(rows) => console.log('Delete', rows)}
        onBulkExport={(rows) => console.log('Export', rows)}
      />

      <EntityForm
        open={formOpen}
        onOpenChange={setFormOpen}
        fields={formFields}
        defaultValues={editUser ? { name: editUser.name, email: editUser.email, role: editUser.role, status: editUser.status } : undefined}
        title={editUser ? 'Edit user' : 'Add user'}
        onSubmit={(values) => console.log(editUser ? 'Update' : 'Create', values)}
      />
    </div>
  )
}
