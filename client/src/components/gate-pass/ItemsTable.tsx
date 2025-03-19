import React from "react";
import { UseFormReturn, FieldArrayWithId } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type GatePassWithItems } from "@shared/schema";

interface ItemsTableProps {
  fields: FieldArrayWithId[];
  form: UseFormReturn<GatePassWithItems>;
  append: (value: { id?: number; name: string; sku: string; quantity: number }) => void;
  remove: (index: number) => void;
}

export function ItemsTable({ fields, form, append, remove }: ItemsTableProps) {
  return (
    <div>
      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-neutral-light">
              <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Item Name</th>
              <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">SKU Number</th>
              <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-16 sm:w-20 md:w-24">Quantity</th>
              <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-14 sm:w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id}>
                <td className="px-2 sm:px-4 py-1 sm:py-2">
                  <Input
                    {...form.register(`items.${index}.name`)}
                    placeholder="Item name"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                  />
                  {form.formState.errors.items?.[index]?.name && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.items?.[index]?.name?.message}
                    </p>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-1 sm:py-2">
                  <Input
                    {...form.register(`items.${index}.sku`)}
                    placeholder="SKU number"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                  />
                  {form.formState.errors.items?.[index]?.sku && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.items?.[index]?.sku?.message}
                    </p>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-1 sm:py-2">
                  <Input
                    {...form.register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                    type="number"
                    placeholder="Qty"
                    min="1"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                  />
                  {form.formState.errors.items?.[index]?.quantity && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.items?.[index]?.quantity?.message}
                    </p>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-1 sm:py-2">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-error hover:text-error-dark h-auto w-auto p-1"
                    >
                      <span className="material-icons text-xs sm:text-base">delete</span>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ id: undefined, name: "", sku: "", quantity: 1 })}
          className="flex items-center text-primary hover:text-primary-dark"
        >
          <span className="material-icons mr-1">add_circle</span> Add Another Item
        </Button>

        <div className="text-sm font-medium bg-neutral-light p-3 rounded">
          <div className="flex space-x-6">
            <div>
              <span className="text-neutral-dark">Total Items:</span>{" "}
              <span className="font-bold">{fields.length}</span>
            </div>
            <div>
              <span className="text-neutral-dark">Total Quantity:</span>{" "}
              <span className="font-bold">
                {fields.reduce((sum, _, index) => {
                  const quantity = form.getValues(`items.${index}.quantity`);
                  return sum + (Number.isNaN(Number(quantity)) ? 0 : Number(quantity));
                }, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 