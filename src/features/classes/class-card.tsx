import { DeleteButton } from "@/components/delete-button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { deleteClass } from "./actions";
import { EditClassDialog } from "./edit-class-dialog";
import type { Class } from "./types";

export function ClassCard({ class: cls }: { class: Class }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-2xl">{cls.name}</CardTitle>
            <CardDescription>{cls.academic_year}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center">
            <EditClassDialog class={cls} />
            <DeleteButton
              action={deleteClass.bind(null, cls.id)}
              confirmText={`Delete class ${cls.name}? Its students, notes, exams, and results are deleted too.`}
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
