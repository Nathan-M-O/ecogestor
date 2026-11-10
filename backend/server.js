import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import './db.js';
import authRoutes from './routes/auth.js';
import aguaRoutes from './routes/agua.js';
import energiaRoutes from './routes/energia.js';
import residuosRoutes from './routes/residuos.js';
import isoRoutes from './routes/iso.js';
import relatoriosRoutes from './routes/relatorios.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoGestor API',
      version: '1.0.0',
      description: 'Web Services para gestão ambiental organizacional (ISO 14.000)'
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: ['./routes/*.js']
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));

app.get('/', (req, res) => res.json({
  nome: 'EcoGestor API', status: 'online', docs: '/api-docs', versao: '1.0.0'
}));

app.use('/api/auth', authRoutes);
app.use('/api/agua', aguaRoutes);
app.use('/api/energia', energiaRoutes);
app.use('/api/residuos', residuosRoutes);
app.use('/api/iso', isoRoutes);
app.use('/api/relatorios', relatoriosRoutes);

app.use((req, res) => res.status(404).json({
  erro: 'Recurso não encontrado',
  mensagem: `Rota ${req.method} ${req.originalUrl} não existe`,
  status: 404
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    erro: err.erro || 'Erro interno',
    mensagem: err.message || 'Erro no servidor',
    status: err.status || 500
  });
});

app.listen(PORT, () => {
  console.log(`\n🌱 EcoGestor API: http://localhost:${PORT}`);
  console.log(`📚 Swagger:      http://localhost:${PORT}/api-docs`);
  console.log(`🔐 Login:        admin@eco.com / admin123\n`);
});