'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EMPTY_STEP_STATE, type StepState } from '@/lib/api/products';
import {
  generateRows,
  type GridColor,
  type GridRow,
  selectionOf,
  SIZE_GRID,
  type SizeType,
} from '@/lib/products/variant-grid';

import { errorProps, FieldError, HiddenRef, inputClass, type StepAction, StepAlerts } from './product-form-parts';

const CELLS: { key: keyof GridRow; api: string; label: string; inputMode?: 'decimal' | 'numeric' }[] = [
  { key: 'price', api: 'priceCents', label: 'Preço (R$)', inputMode: 'decimal' },
  { key: 'compareAt', api: 'compareAtCents', label: 'Preço "de" (R$)', inputMode: 'decimal' },
  { key: 'stock', api: 'stock', label: 'Estoque', inputMode: 'numeric' },
  { key: 'weightGrams', api: 'weightGrams', label: 'Peso (g)', inputMode: 'numeric' },
  { key: 'sku', api: 'sku', label: 'SKU (opcional)' },
];

// Etapa de variantes (AC-084): marca os tamanhos da categoria e as cores; a tabela ganha
// uma linha por combinação. Desmarcar e marcar de novo não perde o que já foi digitado nas
// linhas que continuam. A grade inteira vai num campo oculto, em JSON, para a Server Action.
export function VariantGridEditor({
  productId,
  version,
  sizeType,
  initialRows,
  action,
  initialState = EMPTY_STEP_STATE,
}: {
  productId: string;
  version: number;
  sizeType: SizeType;
  initialRows: GridRow[];
  action: StepAction;
  initialState?: StepState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initial = selectionOf(initialRows);
  const [sizes, setSizes] = useState<string[]>(initial.sizes);
  const [colors, setColors] = useState<GridColor[]>(initial.colors);
  const [rows, setRows] = useState<GridRow[]>(initialRows);
  const [newColor, setNewColor] = useState<GridColor>({ name: '', hex: '#1A1A1A' });

  const regenerate = (nextSizes: string[], nextColors: GridColor[]) => {
    setSizes(nextSizes);
    setColors(nextColors);
    setRows((current) => generateRows(sizeType, nextSizes, nextColors, current));
  };
  const toggleSize = (size: string) =>
    regenerate(sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size], colors);
  const addColor = () => {
    if (!newColor.name.trim()) return;
    regenerate(sizes, [...colors, { name: newColor.name.trim(), hex: newColor.hex.toUpperCase() }]);
    setNewColor({ name: '', hex: newColor.hex });
  };
  const removeColor = (index: number) => regenerate(sizes, colors.filter((_, i) => i !== index));
  const edit = (index: number, key: keyof GridRow, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <form action={formAction} noValidate className="space-y-6">
      <HiddenRef productId={productId} version={version} />
      <input type="hidden" name="payload" value={JSON.stringify(rows)} />
      <StepAlerts state={state} productId={productId} step="variantes" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tamanhos</legend>
        <div className="flex flex-wrap gap-3">
          {SIZE_GRID[sizeType].map((size) => (
            <label key={size} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" data-size={size} checked={sizes.includes(size)} onChange={() => toggleSize(size)} />
              {size}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cores</legend>
        <ul aria-label="Cores" className="flex flex-wrap gap-2">
          {colors.map((color, index) => (
            <li key={color.name} data-color={color.name} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
              <span aria-hidden="true" className="size-4 rounded-full border border-border" style={{ backgroundColor: color.hex }} />
              {color.name}
              <button type="button" onClick={() => removeColor(index)} aria-label={`Remover a cor ${color.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="block">Nome da cor</span>
            <input
              type="text"
              maxLength={30}
              className={inputClass}
              value={newColor.name}
              onChange={(event) => setNewColor({ ...newColor, name: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block">Cor</span>
            <input type="color" value={newColor.hex} onChange={(event) => setNewColor({ ...newColor, hex: event.target.value })} />
          </label>
          <Button type="button" variant="outline" onClick={addColor}>
            Adicionar cor
          </Button>
        </div>
      </fieldset>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Marque pelo menos um tamanho e adicione uma cor para montar a grade.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Tamanho</th>
                <th className="p-2">Cor</th>
                {CELLS.map((cell) => (
                  <th key={cell.key} className="p-2">
                    {cell.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.size}|${row.color}`} data-row={`${row.size}/${row.color}`} className="align-top">
                  <td className="p-2">
                    {row.size}
                    <FieldError state={state} field={`variants.${index}.size`} />
                  </td>
                  <td className="p-2">
                    {row.color}
                    <FieldError state={state} field={`variants.${index}.color`} />
                  </td>
                  {CELLS.map((cell) => {
                    const field = `variants.${index}.${cell.api}`;
                    return (
                      <td key={cell.key} className="p-2">
                        <input
                          type="text"
                          aria-label={`${cell.label}, ${row.size} ${row.color}`}
                          inputMode={cell.inputMode}
                          className={inputClass}
                          value={row[cell.key]}
                          onChange={(event) => edit(index, cell.key, event.target.value)}
                          {...errorProps(state, field)}
                        />
                        <FieldError state={state} field={field} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Gravando...' : 'Salvar e continuar'}
      </Button>
    </form>
  );
}
