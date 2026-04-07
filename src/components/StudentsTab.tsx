import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, PlusCircle, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sheetsService } from "@/services/sheetsService";

interface StudentData {
  id: string;
  name: string;
  dni: string;
  nombre: string;
  apellido: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const StudentsTab = () => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentData | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", apellido: "", documento: "" });

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch("/.netlify/functions/get-estudiantes");
      if (!response.ok) throw new Error("Error al cargar estudiantes");
      const data = await response.json();
      setStudents(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la lista de alumnos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const openAddDialog = () => {
    setEditingStudent(null);
    setFormData({ nombre: "", apellido: "", documento: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (student: StudentData) => {
    setEditingStudent(student);
    setFormData({
      nombre: student.nombre,
      apellido: student.apellido,
      documento: student.dni,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.documento.trim()) {
      toast.error("Todos los campos son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingStudent;
      const url = "/.netlify/functions/manage-estudiantes";
      const body = isEdit
        ? { id: Number(editingStudent.id.replace("student_", "")), ...formData }
        : formData;

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 409) {
        toast.error("Ya existe un alumno con ese documento.");
        return;
      }

      if (!response.ok) {
        throw new Error("Error al guardar");
      }

      toast.success(isEdit ? "Alumno actualizado correctamente." : "Alumno creado correctamente.");
      setDialogOpen(false);
      sheetsService.invalidateStudentCache();
      await fetchStudents();
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar el alumno.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmStudent) return;

    setSaving(true);
    try {
      const id = Number(deleteConfirmStudent.id.replace("student_", ""));
      const response = await fetch("/.netlify/functions/manage-estudiantes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Error al eliminar");

      toast.success("Alumno eliminado correctamente.");
      setDeleteConfirmStudent(null);
      sheetsService.invalidateStudentCache();
      await fetchStudents();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar el alumno.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(term) ||
      s.apellido.toLowerCase().includes(term) ||
      s.dni.toLowerCase().includes(term)
    );
  });

  return (
    <>
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <motion.div variants={itemVariants}>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Gestion de Alumnos</CardTitle>
              <CardDescription>
                {students.length} alumno{students.length !== 1 ? "s" : ""} activo{students.length !== 1 ? "s" : ""} en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, apellido o documento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={openAddDialog} className="shrink-0">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Agregar alumno
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? "No se encontraron alumnos con ese criterio." : "No hay alumnos registrados."}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Apellido</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.apellido}</TableCell>
                          <TableCell>{student.nombre}</TableCell>
                          <TableCell>{student.dni}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(student)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmStudent(student)}
                              title="Eliminar"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Editar alumno" : "Agregar alumno"}</DialogTitle>
            <DialogDescription>
              {editingStudent
                ? "Modifica los datos del alumno."
                : "Completa los datos para registrar un nuevo alumno."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Juan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={formData.apellido}
                onChange={(e) => setFormData((prev) => ({ ...prev, apellido: e.target.value }))}
                placeholder="Ej: Perez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">Documento</Label>
              <Input
                id="documento"
                value={formData.documento}
                onChange={(e) => setFormData((prev) => ({ ...prev, documento: e.target.value }))}
                placeholder="Ej: 12345678"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmStudent}
        onOpenChange={(open) => !open && setDeleteConfirmStudent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar alumno</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion desactivara al alumno{" "}
              <strong>
                {deleteConfirmStudent?.nombre} {deleteConfirmStudent?.apellido}
              </strong>
              . El alumno dejara de aparecer en el sistema pero podra ser reactivado en el futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StudentsTab;
