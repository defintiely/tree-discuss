/**
 * Контракт данных приложения. Правит его ТОЛЬКО оркестратор.
 * Дерево — плоская таблица: связь ребёнка с родителем живёт в самом ребёнке
 * (parent_id + диапазон процитированного текста), отдельной сущности «ребро» нет.
 */

export type NodeId = string;

export type NodeKind = 'root' | 'reply' | 'conclusion';

export const KIND_TITLE: Record<NodeKind, string> = {
  root: 'Начало',
  reply: 'Ответ',
  conclusion: 'Вывод',
};

export type TreeNode = {
  id: NodeId;
  /** Пусто только у корня. */
  parentId: NodeId | null;
  kind: NodeKind;
  title: string;
  text: string;
  x: number;
  y: number;
  /**
   * Диапазон в тексте РОДИТЕЛЯ. null у корня и у ответа на весь текст:
   * такой ответ ничего не цитирует, поэтому и подсвечивать в родителе нечего.
   */
  anchorStart: number | null;
  anchorEnd: number | null;
  /** Цвет шапки узла и рамки его цитаты в родителе. Есть у любого узла. */
  color: string;
  /** Ник того, кто создал узел. Пусто — автор не был указан. */
  author: string;
  /**
   * Процитированный фрагмент ТЕКСТОМ — то, что заполняет внешний источник
   * (LLM, правка файла руками) вместо подсчёта символов. При импорте из него
   * вычисляются anchorStart/anchorEnd; экспорт выписывает его обратно.
   */
  quote: string;
};

export type Reaction = {
  nodeId: NodeId;
  emoji: string;
  count: number;
};

export type DocState = {
  nodes: TreeNode[];
  reactions: Reaction[];
  /**
   * Ширина узлов принадлежит ОБСУЖДЕНИЮ, а не браузеру: участники комнаты
   * должны видеть одну раскладку, иначе текст переносится у каждого по-своему
   * и разговор о «втором абзаце» теряет смысл.
   */
  width: number;
};

/** Кусок текста узла после нарезки по границам якорей его детей. */
export type TextSegment = {
  text: string;
  start: number;
  end: number;
  /** Дети, чьи якоря накрывают этот кусок. Пусто — обычный текст. */
  anchoredBy: NodeId[];
  /** Цвета этих детей, в том же порядке. */
  colors: string[];
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
