import {
  BarChart3,
  // Building2,
  // Calculator,
  // CalendarDays,
  Database,
  // FolderKanban,
  // Home,
  // Landmark,
  LayoutDashboard,
  // LifeBuoy,
  // Mail,
  Megaphone,
  // MessageSquare,
  Package,
  // Settings,
  ShieldCheck,
  // StickyNote,
  Target,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

const EQUIPE = ['MASTER', 'SUPERVISOR'];

// `perfis` limita quem enxerga o item; sem `perfis`, todos veem. Grupos vazios somem.
export const MENU = [
  {
    itens: [
      { para: '/', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
      { para: '/gestao', rotulo: 'Gestão', icone: ShieldCheck, perfis: ['MASTER', 'GERENTE', 'BKO'] },
    ],
  },
  {
    titulo: 'Comercial',
    itens: [
      { para: '/oportunidades', rotulo: 'Oportunidades', icone: Target },
      { para: '/contatos', rotulo: 'Contatos', icone: Users },
      { para: '/bases', rotulo: 'Bases', icone: Database },
      { para: '/promotores', rotulo: 'Promotores', icone: UserCheck, perfis: EQUIPE },
      { para: '/acompanhamento', rotulo: 'Acompanhamento', icone: BarChart3, perfis: EQUIPE },
      { para: '/campanhas', rotulo: 'Campanhas', icone: Megaphone, perfis: EQUIPE },
      { para: '/carteira', rotulo: 'Carteira', icone: Wallet },
      { para: '/produtos', rotulo: 'Produtos', icone: Package },
    ],
  },
//   {
//     titulo: 'Crédito',
//     itens: [
//       { para: '/convenios', rotulo: 'Convênios', icone: Building2 },
//       { para: '/credito', rotulo: 'Crédito', icone: Landmark },
//     ],
//   },
// Desativados por enquanto (Crédito, Imobiliário e Organização; no Sistema só Usuários está ativo). Para voltar, remova os // deste bloco.
//   {
//     titulo: 'Imobiliário',
//     itens: [
//       { para: '/imobiliario', rotulo: 'Imobiliário', icone: Home },
//       { para: '/simulador', rotulo: 'Simulador', icone: Calculator },
//     ],
//   },
//   {
//     titulo: 'Organização',
//     itens: [
//       { para: '/projetos', rotulo: 'Projetos', icone: FolderKanban },
//       { para: '/calendario', rotulo: 'Calendário', icone: CalendarDays },
//       { para: '/observacoes', rotulo: 'Observações', icone: StickyNote },
//       { para: '/mensagens', rotulo: 'Mensagens', icone: MessageSquare },
//       { para: '/marketing', rotulo: 'Marketing', icone: Mail, perfis: ['MASTER', 'GERENTE', 'SUPERVISOR'] },
//     ],
//   },
  {
    titulo: 'Sistema',
    itens: [
      // { para: '/ajuda', rotulo: 'Central de ajuda', icone: LifeBuoy },
      { para: '/usuarios', rotulo: 'Usuários', icone: Users, perfis: EQUIPE },
      // { para: '/configuracoes/assistente', rotulo: 'Assistente (IA)', icone: Settings, perfis: ['MASTER'] },
    ],
  },
];

export const TODOS = MENU.flatMap((g) => g.itens);

export const itemPermitido = (item, perfil) => !item.perfis || item.perfis.includes(perfil);

export const gruposDoPerfil = (perfil) =>
  MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => itemPermitido(i, perfil)) })).filter((g) => g.itens.length);
