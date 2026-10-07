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
  /**
   * Короткое название поста, которое дают участники. Пусто — названия нет:
   * в шапке стоит title, а на дальнем зуме — только серые полосы.
   */
  name: string;
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
  /** Ветка (узел и всё под ним) закрыта: приглушена, новые ответы в неё не пишутся. */
  closed: boolean;
  /** Ники участников, проголосовавших за закрытие ветки; один ник — один голос. */
  closeVotes: string[];
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
  /**
   * Участники обсуждения — те, от чьего имени здесь можно править. Это подпись,
   * а не вход: выбрать можно любой ник из списка.
   */
  participants: string[];
};

/** Предел длины названия: на дальнем зуме оно идёт двойным шрифтом и длинное не влезло бы в две строки. */
export const NAME_MAX = 40;

/**
 * Документ из облака, файла или старой версии приложения: полей, появившихся
 * позже, в нём может не быть, а без них голосование падает на undefined.
 */
export function normalizeDoc(raw: Partial<DocState> & { nodes: Partial<TreeNode>[] }, width: number): DocState {
  return {
    nodes: raw.nodes.map((n) => ({
      ...(n as TreeNode),
      name: typeof n.name === 'string' ? n.name.slice(0, NAME_MAX) : '',
      closed: Boolean(n.closed),
      closeVotes: Array.isArray(n.closeVotes) ? n.closeVotes : [],
    })),
    reactions: raw.reactions ?? [],
    width: raw.width ?? width,
    participants: Array.isArray(raw.participants) ? raw.participants : [],
  };
}

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
