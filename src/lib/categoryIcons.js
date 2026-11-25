// Ícones de categoria: o usuário pode escolher um (campo `icon`); se a categoria
// ainda estiver com o padrão ("tag"), o ícone é sugerido pelo nome.
import {
  Tag, Utensils, ShoppingCart, ShoppingBag, GraduationCap, Gamepad2, Wrench, Zap, CreditCard, User, Home, Car, HeartPulse,
  Plane, PlayCircle, Wifi, Briefcase, Gift, PiggyBank, Dumbbell, PawPrint, Baby, Fuel, Bus, Shirt, Pill, Coffee, Landmark,
  Smartphone, BookOpen, Banknote, TrendingUp, Droplets, Film, Music, Sparkles, Wallet, Receipt, RotateCcw,
} from 'lucide-react';

export const CATEGORY_ICONS = {
  tag: Tag, utensils: Utensils, cart: ShoppingCart, bag: ShoppingBag, education: GraduationCap, game: Gamepad2, wrench: Wrench,
  zap: Zap, card: CreditCard, user: User, home: Home, car: Car, health: HeartPulse, plane: Plane, play: PlayCircle, wifi: Wifi,
  work: Briefcase, gift: Gift, piggy: PiggyBank, gym: Dumbbell, pet: PawPrint, baby: Baby, fuel: Fuel, bus: Bus, shirt: Shirt,
  pill: Pill, coffee: Coffee, bank: Landmark, phone: Smartphone, book: BookOpen, cash: Banknote, invest: TrendingUp,
  water: Droplets, film: Film, music: Music, beauty: Sparkles, wallet: Wallet, receipt: Receipt, refund: RotateCcw,
};

const GUESS = [
  [/aliment|restaur|lanche|comida|ifood|padar/i, 'utensils'], [/supermerc|mercado|atacad|feira/i, 'cart'],
  [/compra|shopping|loja/i, 'bag'], [/educa|curso|escola|faculd|livro/i, 'education'], [/lazer|jogo|game|diver/i, 'game'],
  [/servi[cç]o|manuten|reparo/i, 'wrench'], [/consumo|luz|energia|enel|conta de/i, 'zap'], [/[aá]gua|sabesp/i, 'water'],
  [/cart[aã]o|fatura|cr[eé]dito/i, 'card'], [/pessoa|cuidado/i, 'user'], [/moradia|aluguel|casa|condom/i, 'home'],
  [/transporte|uber|99|t[aá]xi|[oô]nibus|metr/i, 'bus'], [/carro|ve[ií]culo|auto/i, 'car'], [/combust|posto|gasolina/i, 'fuel'],
  [/sa[uú]de|m[eé]dic|plano/i, 'health'], [/farm[aá]c|rem[eé]dio|drog/i, 'pill'], [/viage|hotel|passage/i, 'plane'],
  [/assinatura|stream|netflix|spotify/i, 'play'], [/internet|telefon|celular|vivo|claro|tim/i, 'wifi'],
  [/sal[aá]rio|folha|trabalho|freela/i, 'work'], [/presente|doa[cç]/i, 'gift'], [/investi|rendimento|dividend/i, 'invest'],
  [/poupan|reserva/i, 'piggy'], [/academia|esporte|gym/i, 'gym'], [/pet|veterin/i, 'pet'], [/filho|beb[eê]|creche/i, 'baby'],
  [/roupa|vestu/i, 'shirt'], [/caf[eé]/i, 'coffee'], [/banco|tarifa|juros|imposto/i, 'bank'], [/estorno|reembolso/i, 'refund'],
  [/beleza|est[eé]tica|sal[aã]o/i, 'beauty'],
];

export function categoryIconKey(cat) {
  if (cat?.icon && cat.icon !== 'tag' && CATEGORY_ICONS[cat.icon]) return cat.icon;
  const name = String(cat?.name || '');
  for (const [re, key] of GUESS) if (re.test(name)) return key;
  return 'tag';
}
export const categoryIcon = (cat) => CATEGORY_ICONS[categoryIconKey(cat)] || Tag;
