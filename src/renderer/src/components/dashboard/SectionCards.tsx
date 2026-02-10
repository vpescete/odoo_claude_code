import { TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import type { OdooInstance } from '@shared/types/odoo'

interface SectionCardsProps {
  instances: OdooInstance[]
}

export function SectionCards({ instances }: SectionCardsProps) {
  const total = instances.length
  const running = instances.filter((i) => i.status === 'running').length
  const stopped = instances.filter((i) => i.status === 'stopped').length
  const errors = instances.filter((i) => i.status === 'error').length

  return (
    <div className="grid grid-cols-1 @sm/main:grid-cols-2 @xl/main:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardDescription>Total Instances</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{total}</CardTitle>
          <CardAction>
            <Badge variant="outline">{total} total</Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Running</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{running}</CardTitle>
          <CardAction>
            {running > 0 ? (
              <Badge variant="success" className="gap-1">
                <TrendingUp className="size-3" />
                {running} active
              </Badge>
            ) : (
              <Badge variant="outline">0 active</Badge>
            )}
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Stopped</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{stopped}</CardTitle>
          <CardAction>
            <Badge variant="outline">{stopped} idle</Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Errors</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{errors}</CardTitle>
          <CardAction>
            {errors > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <TrendingDown className="size-3" />
                {errors} error{errors > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="outline">0 errors</Badge>
            )}
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  )
}
