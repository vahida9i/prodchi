import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.ts'

function summarizePayload(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>
    return {
      id: typeof p.id === 'string' ? p.id : null,
      title: typeof p.title === 'string' ? p.title : null,
      questionCount:
        p.questions && typeof p.questions === 'object' && !Array.isArray(p.questions)
          ? Object.keys(p.questions as object).length
          : null
    }
  }
  return { id: null, title: null, questionCount: null }
}

export async function adminImportRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin/imports — history of failed imports, newest first
  // (plan Feature 5: "review past failed imports and why they failed")
  fastify.get('/imports', async (_request, reply) => {
    const failedImports = await prisma.failedImport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return reply.send({
      failedImports: failedImports.map(f => ({
        id: f.id,
        createdAt: f.createdAt,
        errors: f.errors,
        summary: summarizePayload(f.payload)
      }))
    })
  })
}