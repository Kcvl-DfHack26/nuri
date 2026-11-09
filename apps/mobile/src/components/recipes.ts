import type { makeupParts } from '@starter/shared';

import arOverlay1 from '../../assets/plan-a/ar/overlay-1.png';
import arOverlay2 from '../../assets/plan-a/ar/overlay-2.png';
import arOverlay3 from '../../assets/plan-a/ar/overlay-3.png';
import arOverlay4 from '../../assets/plan-a/ar/overlay-4.png';
import arOverlay5 from '../../assets/plan-a/ar/overlay-5.png';
import detailProductBrowPencil from '../../assets/plan-a/detail/product-brow-pencil.jpg';
import iconsBrow from '../../assets/plan-a/icons/brow.svg';
import iconsBrush from '../../assets/plan-a/icons/brush.svg';
import iconsCheek from '../../assets/plan-a/icons/cheek.svg';
import iconsDrop from '../../assets/plan-a/icons/drop.svg';
import iconsEye from '../../assets/plan-a/icons/eye.svg';
import iconsLash from '../../assets/plan-a/icons/lash.svg';
import iconsLip from '../../assets/plan-a/icons/lip.svg';
import iconsSparkle from '../../assets/plan-a/icons/sparkle.svg';
import photosBrowCloseup from '../../assets/plan-a/photos/brow-closeup.jpg';
import faceBare from '../../assets/plan-a/photos/face-bare.jpg';
import faceMadeUp from '../../assets/plan-a/photos/face-made-up.jpg';

// Fixed Plan A sample data for the screens that do not read recipes from the API yet (①, ⑤ and
// the steps of ⑦ do). It lives with the UI because it bundles image assets, which src/lib may not
// import.

export type PartId = (typeof makeupParts)[number];

/** Percent crop of a photo inside its frame, copied from the Figma image fill. */
export type PhotoCrop = {
  width: `${number}%`;
  height: `${number}%`;
  left: `${number}%`;
  top: `${number}%`;
};

export const parts: Record<PartId, { label: string; icon: number; iconBackground: string }> = {
  base: {
    label: 'ベース',
    icon: iconsDrop,
    iconBackground: 'bg-pastel-pink',
  },
  brow: {
    label: '眉',
    icon: iconsBrow,
    iconBackground: 'bg-part-brow',
  },
  eye: {
    label: 'アイメイク',
    icon: iconsEye,
    iconBackground: 'bg-pastel-lilac',
  },
  lash: {
    label: 'まつげ',
    icon: iconsLash,
    iconBackground: 'bg-pastel-mint',
  },
  cheek: {
    label: 'チーク',
    icon: iconsCheek,
    iconBackground: 'bg-pastel-pink',
  },
  shading: {
    label: 'シェーディング',
    icon: iconsBrush,
    iconBackground: 'bg-pastel-peach',
  },
  highlight: {
    label: 'ハイライト',
    icon: iconsSparkle,
    iconBackground: 'bg-base-butter',
  },
  lip: {
    label: 'リップ',
    icon: iconsLip,
    iconBackground: 'bg-part-lip',
  },
};

/** The color a step posted from ⑫ paints on ⑦ when no cosmetic was chosen for it on ⑫-6. */
export const partColors: Record<PartId, string> = {
  base: '#E8C4A8',
  brow: '#79513A',
  eye: '#C56D42',
  lash: '#38251D',
  cheek: '#E8968A',
  shading: '#A17B60',
  highlight: '#F3E3C8',
  lip: '#D9627A',
};

/** ② ホーム（部位メイク）: the eight part cards in Plan A order. */
export const partCards: {
  part: PartId;
  photo: number;
  crop: PhotoCrop;
  dimmed: boolean;
}[] = [
  {
    part: 'base',
    photo: faceMadeUp,
    crop: { width: '235.25%', height: '582.58%', left: '-72.5%', top: '-240.42%' },
    dimmed: true,
  },
  {
    part: 'brow',
    photo: photosBrowCloseup,
    crop: { width: '300.58%', height: '419.35%', left: '-175.43%', top: '-32.26%' },
    dimmed: false,
  },
  {
    part: 'eye',
    photo: faceMadeUp,
    crop: { width: '313.67%', height: '777.67%', left: '-150%', top: '-244.19%' },
    dimmed: true,
  },
  {
    part: 'lash',
    photo: faceMadeUp,
    crop: { width: '427.73%', height: '1058.23%', left: '-111.36%', top: '-348.73%' },
    dimmed: true,
  },
  {
    part: 'cheek',
    photo: faceMadeUp,
    crop: { width: '294.06%', height: '730.13%', left: '-162.5%', top: '-266.38%' },
    dimmed: true,
  },
  {
    part: 'shading',
    photo: faceMadeUp,
    crop: { width: '247.63%', height: '614.71%', left: '-28.95%', top: '-262.5%' },
    dimmed: true,
  },
  {
    part: 'highlight',
    photo: faceMadeUp,
    crop: { width: '361.92%', height: '898.92%', left: '-138.46%', top: '-344.09%' },
    dimmed: true,
  },
  {
    part: 'lip',
    photo: faceBare,
    crop: { width: '294.12%', height: '718.27%', left: '-97.06%', top: '-349.8%' },
    dimmed: false,
  },
];

/**
 * Plan A's AR overlays for the fox recipe, drawn over the camera frame (390×844) by the step's part.
 * They stand in for every recipe until ⑦ draws each step's texture on the tracked face (#31).
 */
export const arOverlays: Partial<Record<PartId, number>> = {
  brow: arOverlay1,
  eye: arOverlay2,
  lash: arOverlay3,
  shading: arOverlay4,
  cheek: arOverlay5,
};

/** ⑥ 商品詳細: the sheet opened from a product row on ⑤. */
export type ProductInfo = {
  brand: string;
  /** Product name without the brand, shown under it. */
  title: string;
  price: string;
  colors: { name: string; hex: string }[];
  /** Index into `colors` that the sheet opens with. */
  initialColor: number;
  freeFrom: string[];
  /** Key ingredients with the Plan A dot color class. */
  ingredients: { name: string; role: string; dot: string }[];
};

/** ⑥ 商品詳細 data until products come from the API, keyed by the API's product ID. */
type Product = {
  id: string;
  image: number;
  info: ProductInfo;
};

const products: Product[] = [
  {
    id: 'celane-brow-pencil',
    image: detailProductBrowPencil,
    info: {
      brand: 'CELANE',
      title: '極細アイブロウペンシル',
      price: '¥1,320',
      // Plan A names only the selected shade; the others are sample names.
      colors: [
        { name: '01 ライトブラウン', hex: '#B48A6A' },
        { name: '02 ナチュラルブラウン', hex: '#9A6B4F' },
        { name: '03 モカブラウン', hex: '#7A5236' },
        { name: '04 ダークブラウン', hex: '#5A3A26' },
        { name: '05 ブラウンブラック', hex: '#3E2A20' },
      ],
      initialColor: 2,
      freeFrom: ['アルコールフリー', '無香料', 'パラベンフリー'],
      ingredients: [
        { name: 'トコフェロール', role: '保湿・酸化を防ぐ', dot: 'bg-pastel-sky' },
        { name: 'シリカ', role: '描き心地をなめらかに', dot: 'bg-pastel-lilac' },
        { name: '酸化鉄', role: '色をつける', dot: 'bg-pastel-peach' },
      ],
    },
  },
];

export function findProduct(id: string) {
  return products.find((product) => product.id === id);
}

export function isPartId(value: string): value is PartId {
  return Object.hasOwn(parts, value);
}

/** Plan A shares one camera frame and one finished look across the AR flow. */
export const arPhotos = { camera: faceBare, finished: faceMadeUp };
