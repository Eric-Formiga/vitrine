// Guia de medidas da categoria (ASM-008): uma tabela simples, mostrada na página do produto.
// Ex.: columns = ['Tamanho', 'Busto', 'Cintura'], rows = [['P', '86', '68'], ['M', '90', '72']].
export interface SizeChart {
  columns: string[];
  rows: string[][];
}

export function isRectangular(chart: SizeChart): boolean {
  return chart.rows.every((row) => row.length === chart.columns.length);
}
