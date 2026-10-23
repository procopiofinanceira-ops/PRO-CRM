import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Oportunidades from './pages/Oportunidades.jsx';
import Contatos from './pages/Contatos.jsx';
import Produtos from './pages/Produtos.jsx';
import Projetos from './pages/Projetos.jsx';
import Calendario from './pages/Calendario.jsx';
import Observacoes from './pages/Observacoes.jsx';
import Bases from './pages/Bases.jsx';
import Convenios from './pages/Convenios.jsx';
import Credito from './pages/Credito.jsx';
import Carteira from './pages/Carteira.jsx';
import Acompanhamento from './pages/Acompanhamento.jsx';
import Campanhas from './pages/Campanhas.jsx';
import Marketing from './pages/Marketing.jsx';
import Mensagens from './pages/Mensagens.jsx';
import Ajuda from './pages/Ajuda.jsx';
import Imobiliario from './pages/Imobiliario.jsx';
import Simulador from './pages/Simulador.jsx';
import Gestao from './pages/Gestao.jsx';
import Usuarios from './pages/Usuarios.jsx';
import ConfigAssistente from './pages/ConfigAssistente.jsx';
import Promotores from './pages/Promotores.jsx';

export default function App() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">Carregando…</div>
    );
  }

  if (!usuario) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="oportunidades" element={<Oportunidades />} />
          <Route path="contatos" element={<Contatos />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="projetos" element={<Projetos />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="observacoes" element={<Observacoes />} />
          <Route path="bases" element={<Bases />} />
          <Route path="convenios" element={<Convenios />} />
          <Route path="credito" element={<Credito />} />
          <Route path="carteira" element={<Carteira />} />
          <Route path="acompanhamento" element={<Acompanhamento />} />
          <Route path="campanhas" element={<Campanhas />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="mensagens" element={<Mensagens />} />
          <Route path="ajuda" element={<Ajuda />} />
          <Route path="imobiliario" element={<Imobiliario />} />
          <Route path="simulador" element={<Simulador />} />
          <Route path="gestao" element={<Gestao />} />
          <Route path="promotores" element={<Promotores />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="configuracoes/assistente" element={<ConfigAssistente />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
