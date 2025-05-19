# Task List

## Enhancements for `Statistics.tsx` ("Asistencia por Estudiante" Table)

- [x] **Filter by Student Name**: Add an input field to filter the student list by name.
- [x] **Display All Students & Paginate**: Modify the table to show all students and implement pagination for easier navigation.
- [x] **Default Sort Order**: Change the default sorting of students to be alphabetical by name.
- [ ] ~~**Detailed Weekly Attendance View (Statistics.tsx)**: For a filtered student, display their attendance (Presente/Ausente) for each registered week.~~ (Deferred - Requires backend data changes)

## Enhancements for `TeacherPanel.tsx` ("Asistencia por Estudiante" Table in Statistics Tab)

- [x] **Filter by Student Name**: Add an input field to filter the student list by name.
- [x] **Display All Students & Paginate**: Modify the table to show all students and implement pagination for easier navigation.
- [x] **Default Sort Order**: Change the default sorting of students to be alphabetical by name.

## Progress Notes:

*   **`Statistics.tsx` - Filter by Student Name**: Implemented.
*   **`Statistics.tsx` - Display All Students & Paginate**: Implemented.
*   **`Statistics.tsx` - Default Sort Order**: Implemented (students are sorted alphabetically before pagination).
*   **`TeacherPanel.tsx` - Filter by Student Name**: Implemented.
*   **`TeacherPanel.tsx` - Display All Students & Paginate**: Implemented.
*   **`TeacherPanel.tsx` - Default Sort Order**: Implemented (students are sorted alphabetically before pagination).
*   **Detailed Weekly Attendance View**: This task is currently deferred as it depends on changes to the data source (`sheetsService.getStatistics()` or a new backend endpoint) to supply the necessary granular attendance data. 