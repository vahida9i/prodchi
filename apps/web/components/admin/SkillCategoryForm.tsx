"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

const skillCategorySchema = z.object({
  name: z.string().min(1),
  roleId: z.string().uuid(),
  order: z.number().int().default(0)
})

type SkillCategoryFormData = z.infer<typeof skillCategorySchema>

interface SkillFormProps {
  onSubmit: (data: SkillCategoryFormData) => Promise<void>
  initialData?: Partial<SkillCategoryFormData>
  roles: Array<{ id: string; name: string }>
  isLoading?: boolean
}

export function SkillCategoryForm({ onSubmit, initialData, roles, isLoading }: SkillFormProps) {
  const form = useForm<SkillCategoryFormData>({
    resolver: zodResolver(skillCategorySchema),
    defaultValues: {
      name: '',
      roleId: '',
      order: 0,
      ...initialData
    }
  })

  const handleSubmit = async (data: SkillCategoryFormData) => {
    await onSubmit(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Skill Category' : 'Create Skill Category'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="e.g., Research & Discovery"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <Select
              value={form.watch('roleId')}
              onValueChange={(value) => form.setValue('roleId', value, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.roleId && (
              <p className="text-sm text-destructive">{form.formState.errors.roleId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="order">Order</Label>
            <Input
              id="order"
              type="number"
              {...form.register('order', { valueAsNumber: true })}
              min={0}
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}