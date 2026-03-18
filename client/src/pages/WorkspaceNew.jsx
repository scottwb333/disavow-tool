import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function WorkspaceNew() {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      const { data } = await api.post('/workspaces', { name })
      navigate(`/w/${data._id}`)
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Create workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input
              placeholder="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
