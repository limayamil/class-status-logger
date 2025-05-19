# Task List: Enhancements for Statistics.tsx

## "Asistencia por Estudiante" Table Improvements

- [x] **Filter by Student Name**: Add an input field to filter the student list by name.
- [x] **Display All Students & Paginate**: Modify the table to show all students and implement pagination for easier navigation.
- [x] **Default Sort Order**: Change the default sorting of students to be alphabetical by name.
- [ ] ~~**Detailed Weekly Attendance View**: For a filtered student, display their attendance (Presente/Ausente) for each registered week.~~ (Deferred - This feature requires backend data modifications to provide per-student, per-week attendance status. The current data only provides total attendance counts.)

## Progress Notes:

*   **Filter by Student Name**: Implemented.
*   **Display All Students & Paginate**: Implemented.
*   **Default Sort Order**: Implemented (students are sorted alphabetically before pagination).
*   **Detailed Weekly Attendance View**: This task is currently deferred as it depends on changes to the data source (`sheetsService.getStatistics()` or a new backend endpoint) to supply the necessary granular attendance data. 