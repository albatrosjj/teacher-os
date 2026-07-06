import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Class } from "./types";

export function ClassCard({ class: cls }: { class: Class }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{cls.name}</CardTitle>
        <CardDescription>{cls.academic_year}</CardDescription>
      </CardHeader>
    </Card>
  );
}
