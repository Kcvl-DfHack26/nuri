import arOverlay1 from '../../assets/plan-a/ar/overlay-1.png';
import arOverlay2 from '../../assets/plan-a/ar/overlay-2.png';
import arOverlay3 from '../../assets/plan-a/ar/overlay-3.png';
import arOverlay4 from '../../assets/plan-a/ar/overlay-4.png';
import arOverlay5 from '../../assets/plan-a/ar/overlay-5.png';
import detailAvatar from '../../assets/plan-a/detail/avatar.png';
import detailProductBrowPencil from '../../assets/plan-a/detail/product-brow-pencil.jpg';
import detailProductCheek from '../../assets/plan-a/detail/product-cheek.jpg';
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
import recipesCat from '../../assets/plan-a/recipes/cat.jpg';
import recipesFox from '../../assets/plan-a/recipes/fox.jpg';
import recipesKorean from '../../assets/plan-a/recipes/korean.jpg';
import recipesLong from '../../assets/plan-a/recipes/long.jpg';
import recipesOffice from '../../assets/plan-a/recipes/office.jpg';
import recipesRound from '../../assets/plan-a/recipes/round.jpg';

// Fixed Plan A sample data until recipes come from the API. It lives with the UI because
// it bundles image assets, which src/lib may not import.

export type PartId = 'base' | 'brow' | 'eye' | 'lash' | 'cheek' | 'shading' | 'highlight' | 'lip';

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
    iconBackground: 'bg-[#ffd5ad]',
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
    iconBackground: 'bg-[#ffa7c2]',
  },
};

/** ② ホーム（部位メイク）: the eight part cards in Plan A order. */
export const partCards: {
  part: PartId;
  recipeCount: number;
  photo: number;
  crop: PhotoCrop;
  dimmed: boolean;
}[] = [
  {
    part: 'base',
    recipeCount: 128,
    photo: faceMadeUp,
    crop: { width: '235.25%', height: '582.58%', left: '-72.5%', top: '-240.42%' },
    dimmed: true,
  },
  {
    part: 'brow',
    recipeCount: 96,
    photo: photosBrowCloseup,
    crop: { width: '300.58%', height: '419.35%', left: '-175.43%', top: '-32.26%' },
    dimmed: false,
  },
  {
    part: 'eye',
    recipeCount: 214,
    photo: faceMadeUp,
    crop: { width: '313.67%', height: '777.67%', left: '-150%', top: '-244.19%' },
    dimmed: true,
  },
  {
    part: 'lash',
    recipeCount: 72,
    photo: faceMadeUp,
    crop: { width: '427.73%', height: '1058.23%', left: '-111.36%', top: '-348.73%' },
    dimmed: true,
  },
  {
    part: 'cheek',
    recipeCount: 153,
    photo: faceMadeUp,
    crop: { width: '294.06%', height: '730.13%', left: '-162.5%', top: '-266.38%' },
    dimmed: true,
  },
  {
    part: 'shading',
    recipeCount: 61,
    photo: faceMadeUp,
    crop: { width: '247.63%', height: '614.71%', left: '-28.95%', top: '-262.5%' },
    dimmed: true,
  },
  {
    part: 'highlight',
    recipeCount: 48,
    photo: faceMadeUp,
    crop: { width: '361.92%', height: '898.92%', left: '-138.46%', top: '-344.09%' },
    dimmed: true,
  },
  {
    part: 'lip',
    recipeCount: 187,
    photo: faceBare,
    crop: { width: '294.12%', height: '718.27%', left: '-97.06%', top: '-349.8%' },
    dimmed: false,
  },
];

export type MakeupStep = {
  part: PartId;
  /** Short label in the step list, e.g. シャドウ. */
  label: string;
  title: string;
  hint: string;
  product: string;
  /** Recommended colors shown in the swatch and caption. */
  colors: string[];
  /** Plan A AR overlay drawn over the camera frame (390×844). */
  overlay: number;
};

export type Product = {
  name: string;
  detail: string;
  image: number;
  purchasable: boolean;
};

export type Recipe = {
  id: string;
  title: string;
  author: string;
  likes: string;
  thumbnail: number;
  detail?: {
    tags: { label: string; background: string }[];
    source: string;
    avatar: number;
    /** Steps shown on ⑤ as pins and icons, including ones without an AR screen yet. */
    overview: PartId[];
    productCount: number;
    products: Product[];
    steps: MakeupStep[];
  };
};

const foxSteps: MakeupStep[] = [
  {
    part: 'brow',
    label: '眉',
    title: '眉尻を濃く、眉頭は淡く',
    hint: 'スクリューブラシで眉頭の毛を立てる',
    product: 'アイブロウ（微アーチ眉）',
    colors: ['#79513A'],
    overlay: arOverlay1,
  },
  {
    part: 'eye',
    label: 'シャドウ',
    title: '目尻側から横長にぼかす',
    hint: '中間・締め色は目頭側へ薄く',
    product: 'アイシャドウ（ベース・中間・締め）',
    colors: ['#E5B58A', '#C56D42', '#713E2C'],
    overlay: arOverlay2,
  },
  {
    part: 'lash',
    label: 'ライン',
    title: '黒目の外側から徐々に太く',
    hint: '目尻は斜め上に跳ね上げ三角を埋める',
    product: 'アイライン',
    colors: ['#38251D'],
    overlay: arOverlay3,
  },
  {
    part: 'shading',
    label: 'シェード',
    title: '骨の凹みに沿って滑らせる',
    hint: '外側から内側へ境目を馴染ませる',
    product: 'シェーディング',
    colors: ['#A17B60'],
    overlay: arOverlay4,
  },
  {
    part: 'cheek',
    label: 'チーク',
    title: 'こめかみへ斜め上に滑らせる',
    hint: '頬骨の高い位置から丸く広げない',
    product: 'チーク',
    colors: ['#B8754F'],
    overlay: arOverlay5,
  },
];

/** ① ホーム（全体メイク）: cards in reading order (left, right, left, …). */
export const recipes: Recipe[] = [
  {
    id: 'fox',
    title: '狐メイク',
    author: 'mio',
    likes: '1.2k',
    thumbnail: recipesFox,
    detail: {
      tags: [
        { label: '＃丸顔向け', background: 'bg-base-peach' },
        { label: '＃15分', background: 'bg-base-lilac' },
        { label: '6ステップ', background: 'bg-base-mint' },
      ],
      source: 'Instagramから取り込み・保存 1.2k',
      avatar: detailAvatar,
      overview: ['brow', 'eye', 'lash', 'shading', 'cheek', 'lip'],
      productCount: 6,
      products: [
        {
          name: 'CELANE 極細アイブロウペンシル',
          detail: '眉・モカブラウン',
          image: detailProductBrowPencil,
          purchasable: false,
        },
        {
          name: 'ムースチーク',
          detail: 'チーク・コーラル',
          image: detailProductCheek,
          purchasable: true,
        },
      ],
      steps: foxSteps,
    },
  },
  {
    id: 'round',
    title: '丸顔メイク',
    author: 'mio',
    likes: '1.2k',
    thumbnail: recipesRound,
  },
  {
    id: 'cat',
    title: '猫メイク',
    author: 'mio',
    likes: '1.2k',
    thumbnail: recipesCat,
  },
  {
    id: 'long',
    title: '面長メイク',
    author: 'mio',
    likes: '1.2k',
    thumbnail: recipesLong,
  },
  {
    id: 'office',
    title: '5分で仕上げるオフィス顔',
    author: 'kana',
    likes: '864',
    thumbnail: recipesOffice,
  },
  {
    id: 'korean',
    title: '透明感の韓国風',
    author: 'yuna',
    likes: '3.4k',
    thumbnail: recipesKorean,
  },
];

export function findRecipe(id: string) {
  return recipes.find((recipe) => recipe.id === id);
}

/** Plan A shares one camera frame and one finished look across the AR flow. */
export const arPhotos = { camera: faceBare, finished: faceMadeUp };
