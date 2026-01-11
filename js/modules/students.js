/**
 * GymFlow - Students Module
 * Student management for Personal Trainers
 */

import { db, STORES } from '../database.js';
import { logger } from '../utils/logger.js';

class StudentsManager {
  constructor() {
    this.statusColors = {
      active: 'var(--accent-success)',
      inactive: 'var(--accent-muted)',
      pending: 'var(--accent-warning)'
    };
  }

  /**
   * Add a new student
   */
  async addStudent(trainerId, studentData) {
    try {
      return await db.add(STORES.students, {
        trainerId,
        status: 'active',
        ...studentData,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error adding student:', error);
      throw error;
    }
  }

  /**
   * Get all students for a trainer
   */
  async getStudents(trainerId) {
    try {
      const students = await db.getByIndex(STORES.students, 'trainerId', trainerId);
      return students.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      logger.error('Error getting students:', error);
      throw error;
    }
  }

  /**
   * Get a single student
   */
  async getStudent(id) {
    try {
      return await db.get(STORES.students, id);
    } catch (error) {
      logger.error('Error getting student:', error);
      throw error;
    }
  }

  /**
   * Update student data
   */
  async updateStudent(student) {
    try {
      return await db.update(STORES.students, student);
    } catch (error) {
      logger.error('Error updating student:', error);
      throw error;
    }
  }

  /**
   * Delete student
   */
  async deleteStudent(id) {
    try {
      return await db.delete(STORES.students, id);
    } catch (error) {
      logger.error('Error deleting student:', error);
      throw error;
    }
  }

  /**
   * Get student count
   */
  async getStudentCount(trainerId) {
    try {
      const students = await this.getStudents(trainerId);
      return {
        total: students.length,
        active: students.filter(s => s.status === 'active').length,
        inactive: students.filter(s => s.status === 'inactive').length
      };
    } catch (error) {
      logger.error('Error counting students:', error);
      return { total: 0, active: 0, inactive: 0 };
    }
  }

  /**
   * Assign workout to student
   */
  async assignWorkout(studentId, workoutId) {
    try {
      const student = await this.getStudent(studentId);
      if (!student) return null;

      const assignedWorkouts = student.assignedWorkouts || [];
      if (!assignedWorkouts.includes(workoutId)) {
        assignedWorkouts.push(workoutId);
        student.assignedWorkouts = assignedWorkouts;
        await this.updateStudent(student);
      }
      return student;
    } catch (error) {
      logger.error('Error assigning workout:', error);
      throw error;
    }
  }

  /**
   * Remove workout from student
   */
  async removeWorkout(studentId, workoutId) {
    try {
      const student = await this.getStudent(studentId);
      if (!student) return null;

      student.assignedWorkouts = (student.assignedWorkouts || []).filter(id => id !== workoutId);
      await this.updateStudent(student);
      return student;
    } catch (error) {
      logger.error('Error removing workout:', error);
      throw error;
    }
  }

  /**
   * Get student's assigned workouts
   */
  async getStudentWorkouts(studentId) {
    try {
      const student = await this.getStudent(studentId);
      if (!student || !student.assignedWorkouts) return [];

      const workouts = [];
      for (const workoutId of student.assignedWorkouts) {
        const workout = await db.get(STORES.workouts, workoutId);
        if (workout) workouts.push(workout);
      }
      return workouts;
    } catch (error) {
      logger.error('Error getting student workouts:', error);
      return [];
    }
  }

  /**
   * Generate invite code
   */
  generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Render student card
   */
  renderStudentCard(student) {
    const statusColor = this.statusColors[student.status] || this.statusColors.inactive;
    const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const workoutCount = student.assignedWorkouts?.length || 0;

    return `
      <div class="card student-card" data-student-id="${student.id}" style="cursor: pointer;">
        <div style="display: flex; gap: var(--spacing-md); align-items: center;">
          <div style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--gradient-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: white;
            font-size: var(--font-size-lg);
          ">${initials}</div>
          
          <div style="flex: 1;">
            <h4 style="margin-bottom: 2px;">${student.name}</h4>
            <div style="display: flex; gap: var(--spacing-sm); align-items: center;">
              <span style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${statusColor};
              "></span>
              <span style="font-size: var(--font-size-sm); color: var(--text-muted);">
                ${student.status === 'active' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
          
          <div style="text-align: right;">
            <div style="font-size: var(--font-size-lg); font-weight: 600; color: var(--accent-primary);">
              ${workoutCount}
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
              treinos
            </div>
          </div>
        </div>
        
        ${student.email ? `
          <div style="
            margin-top: var(--spacing-md);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--border-color);
            font-size: var(--font-size-sm);
            color: var(--text-muted);
          ">
            📧 ${student.email}
            ${student.phone ? `<br>📱 ${student.phone}` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render student form
   */
  renderStudentForm(student = null) {
    return `
      <form id="student-form">
        <div class="form-group">
          <label class="form-label">Nome Completo *</label>
          <input type="text" class="form-input" name="name" 
            value="${student?.name || ''}" required placeholder="Ex: João Silva">
        </div>
        
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" name="email" 
            value="${student?.email || ''}" placeholder="joao@email.com">
        </div>
        
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input type="tel" class="form-input" name="phone" 
            value="${student?.phone || ''}" placeholder="(11) 99999-9999">
        </div>
        
        <div class="form-group">
          <label class="form-label">Data de Nascimento</label>
          <input type="date" class="form-input" name="birthDate" 
            value="${student?.birthDate || ''}">
        </div>
        
        <div class="form-group">
          <label class="form-label">Objetivo Principal</label>
          <select class="form-select" name="objective">
            <option value="">Selecione...</option>
            <option value="emagrecimento" ${student?.objective === 'emagrecimento' ? 'selected' : ''}>Emagrecimento</option>
            <option value="hipertrofia" ${student?.objective === 'hipertrofia' ? 'selected' : ''}>Hipertrofia</option>
            <option value="condicionamento" ${student?.objective === 'condicionamento' ? 'selected' : ''}>Condicionamento</option>
            <option value="saude" ${student?.objective === 'saude' ? 'selected' : ''}>Saúde e Bem-estar</option>
            <option value="forca" ${student?.objective === 'forca' ? 'selected' : ''}>Força</option>
            <option value="reabilitacao" ${student?.objective === 'reabilitacao' ? 'selected' : ''}>Reabilitação</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-input" name="notes" rows="3" 
            placeholder="Restrições, preferências, etc...">${student?.notes || ''}</textarea>
        </div>
        
        ${student ? `
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" name="status">
              <option value="active" ${student.status === 'active' ? 'selected' : ''}>Ativo</option>
              <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        ` : ''}
      </form>
    `;
  }

  /**
   * Render student detail view
   */
  renderStudentDetail(student, workouts = []) {
    const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return `
      <div style="text-align: center; margin-bottom: var(--spacing-xl);">
        <div style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          font-size: var(--font-size-2xl);
          margin: 0 auto var(--spacing-md);
        ">${initials}</div>
        <h3>${student.name}</h3>
        ${student.email ? `<p style="color: var(--text-muted);">${student.email}</p>` : ''}
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
        <div style="text-align: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-primary);">
            ${workouts.length}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Treinos</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-secondary);">
            ${student.objective ? '✓' : '-'}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Objetivo</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
          <div style="font-size: var(--font-size-xl); font-weight: 700; color: ${this.statusColors[student.status]};">
            ${student.status === 'active' ? '●' : '○'}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Status</div>
        </div>
      </div>
      
      <h4 style="margin-bottom: var(--spacing-md);">📋 Treinos Atribuídos</h4>
      ${workouts.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          ${workouts.map(w => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: var(--spacing-md);
              background: var(--bg-tertiary);
              border-radius: var(--radius-md);
            ">
              <span style="font-weight: 500;">${w.name}</span>
              <button class="btn btn-sm btn-secondary remove-workout-btn" data-workout-id="${w.id}">
                Remover
              </button>
            </div>
          `).join('')}
        </div>
      ` : `
        <p style="color: var(--text-muted); text-align: center; padding: var(--spacing-xl);">
          Nenhum treino atribuído ainda
        </p>
      `}
      
      <div style="margin-top: var(--spacing-xl); display: flex; gap: var(--spacing-md);">
        <button class="btn btn-primary" id="assign-workout-btn" style="flex: 1;">
          + Atribuir Treino
        </button>
        <button class="btn btn-secondary" id="edit-student-btn">
          Editar
        </button>
      </div>
    `;
  }

  /**
   * Render stats dashboard for trainers
   */
  renderTrainerStats(counts) {
    return `
      <div class="grid grid-auto-fit" style="margin-bottom: var(--spacing-xl);">
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-value">${counts.total}</div>
          <div class="stat-label">Total de Alunos</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--accent-success);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="stat-value">${counts.active}</div>
          <div class="stat-label">Alunos Ativos</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--text-muted);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="stat-value">${counts.inactive}</div>
          <div class="stat-label">Inativos</div>
        </div>
      </div>
    `;
  }
}

// Export singleton
const studentsManager = new StudentsManager();
export { studentsManager };
