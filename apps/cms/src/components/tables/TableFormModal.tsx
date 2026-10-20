import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createTableSchema, type CreateTableInput, type TableDto } from '@qr-menu/shared';
import { ApiError, errorMessage } from '../../lib/api';
import { useCreateTable, useUpdateTable } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface TableFormModalProps {
  table: TableDto | null;
  onClose: () => void;
}

function numberError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (/nan|expected number|invalid input/i.test(message)) return 'Enter a table number';
  if (/>=\s*1|too small/i.test(message)) return 'Table numbers start at 1';
  if (/<=\s*9999|too big/i.test(message)) return 'Table numbers go up to 9999';
  if (/integer/i.test(message)) return 'Use a whole number';
  return message;
}

/** Add / edit a table: number (encoded in the QR URL) and label (printed on the card). */
export function TableFormModal({ table, onClose }: TableFormModalProps) {
  const { restaurant, isMobile } = useRestaurantContext();
  const toast = useToast();
  const create = useCreateTable(restaurant.id);
  const update = useUpdateTable(restaurant.id);
  const form = useForm<CreateTableInput>({
    resolver: zodResolver(createTableSchema),
    defaultValues: { number: table?.number, label: table?.label ?? '' },
  });

  const submit = form.handleSubmit(async (values) => {
    const input = { number: values.number, label: values.label?.trim() ? values.label.trim() : `Table ${values.number}` };
    try {
      if (table) {
        await update.mutateAsync({ id: table.id, input });
        toast.success('Table updated');
      } else {
        await create.mutateAsync(input);
        toast.success(`${input.label} added`);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TABLE_NUMBER_TAKEN') {
        form.setError('number', { message: `Table ${values.number} already exists` });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  const controlSize = isMobile ? 'lg' : 'md';
  return (
    <Modal
      open
      onClose={onClose}
      title={table ? 'Edit table' : 'Add table'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={form.formState.isSubmitting} onClick={() => void submit()}>
            {table ? 'Save' : 'Add table'}
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        <Field label="Table number" htmlFor="table-number" hint="Guests land on the menu with this table pre-selected." error={numberError(form.formState.errors.number?.message)}>
          <Input
            id="table-number"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            controlSize={controlSize}
            invalid={Boolean(form.formState.errors.number)}
            data-autofocus
            {...form.register('number', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Label" htmlFor="table-label" hint="Printed on the QR card, e.g. “Terrace 3”." error={form.formState.errors.label?.message}>
          <Input id="table-label" placeholder={`Table ${form.watch('number') || ''}`.trim()} maxLength={50} controlSize={controlSize} invalid={Boolean(form.formState.errors.label)} {...form.register('label')} />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Submit
          </button>
      </form>
    </Modal>
  );
}
