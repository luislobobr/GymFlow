/**
 * GymFlow - History Module
 * Workout history and progress tracking
 */

import { db, STORES } from '../database.js';

class HistoryManager {
    constructor() {
        this.chartColors = {
            primary: '#10b981',
            secondary: '#06b6d4',
            accent: '#8b5cf6',
            warning: '#f59e0b'
        };
    }

    /**
     * Get all history entries for user
     */
    async getHistory(userId, limit = 50) {
        const history = await db.getByIndex(STORES.history, 'userId', userId);
        return history.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)).slice(0, limit);
    }

    /**
     * Get history entry by ID
     */
    async getEntry(id) {
        return db.get(STORES.history, id);
    }

    /**
     * Delete history entry
     */
    async deleteEntry(id) {
        return db.delete(STORES.history, id);
    }

    /**
     * Get stats for a period
     */
    async getStats(userId, days = 30) {
        const history = await this.getHistory(userId, 100);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const filtered = history.filter(h => new Date(h.startTime) >= cutoffDate);

        return {
            totalWorkouts: filtered.length,
            totalMinutes: filtered.reduce((sum, h) => sum + (h.durationMinutes || 0), 0),
            totalSets: filtered.reduce((sum, h) => sum + (h.totalSets || 0), 0),
            totalVolume: filtered.reduce((sum, h) => sum + (h.totalVolume || 0), 0),
            avgDuration: filtered.length > 0
                ? Math.round(filtered.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / filtered.length)
                : 0,
            streak: this.calculateStreak(filtered)
        };
    }

    /**
     * Calculate workout streak
     */
    calculateStreak(history) {
        if (history.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Group by date
        const dates = [...new Set(history.map(h => {
            const d = new Date(h.startTime);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }))].sort((a, b) => b - a);

        for (let i = 0; i < dates.length; i++) {
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);
            expectedDate.setHours(0, 0, 0, 0);

            if (dates.includes(expectedDate.getTime())) {
                streak++;
            } else if (i === 0 && !dates.includes(today.getTime())) {
                // Allow missing today
                continue;
            } else {
                break;
            }
        }

        return streak;
    }

    /**
     * Get data for charts
     */
    async getChartData(userId, days = 30) {
        const history = await this.getHistory(userId, 100);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const filtered = history.filter(h => new Date(h.startTime) >= cutoffDate);

        // Group by date
        const byDate = {};
        filtered.forEach(h => {
            const date = new Date(h.startTime).toISOString().split('T')[0];
            if (!byDate[date]) {
                byDate[date] = { workouts: 0, duration: 0, volume: 0, sets: 0 };
            }
            byDate[date].workouts++;
            byDate[date].duration += h.durationMinutes || 0;
            byDate[date].volume += h.totalVolume || 0;
            byDate[date].sets += h.totalSets || 0;
        });

        // Fill missing dates
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);

            data.push({
                date: dateStr,
                label: dayName,
                ...byDate[dateStr] || { workouts: 0, duration: 0, volume: 0, sets: 0 }
            });
        }

        return data;
    }

    /**
     * Get exercise progression data
     */
    async getExerciseProgression(userId, exerciseName, days = 90) {
        const history = await this.getHistory(userId, 200);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const progression = [];

        history
            .filter(h => new Date(h.startTime) >= cutoffDate)
            .forEach(session => {
                session.exercises?.forEach(ex => {
                    if (ex.name === exerciseName && ex.logsPerSet?.length > 0) {
                        const maxWeight = Math.max(...ex.logsPerSet.map(l => l.weight || 0));
                        const totalReps = ex.logsPerSet.reduce((sum, l) => sum + (l.reps || 0), 0);

                        progression.push({
                            date: session.startTime,
                            maxWeight,
                            totalReps,
                            volume: ex.logsPerSet.reduce((sum, l) => sum + ((l.weight || 0) * (l.reps || 0)), 0)
                        });
                    }
                });
            });

        return progression.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Format duration string
     */
    formatDuration(minutes) {
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}min`;
    }

    /**
     * Format date relative
     */
    formatRelativeDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `${diffDays} dias atrás`;
        return date.toLocaleDateString('pt-BR');
    }

    /**
     * Render history card
     */
    renderHistoryCard(entry) {
        const duration = entry.durationMinutes || 0;
        const sets = entry.totalSets || 0;
        const exercises = entry.exercises?.filter(e => e.completed).length || 0;

        return `
      <div class="card history-card" data-history-id="${entry.id}" style="cursor: pointer;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="margin-bottom: var(--spacing-xs);">${entry.workoutName}</h4>
            <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
              ${this.formatRelativeDate(entry.startTime)}
            </p>
          </div>
          <span style="
            background: var(--accent-primary);
            color: white;
            padding: 4px 12px;
            border-radius: var(--radius-full);
            font-size: var(--font-size-xs);
            font-weight: 600;
          ">
            ${this.formatDuration(duration)}
          </span>
        </div>
        
        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-color);
        ">
          <div style="text-align: center;">
            <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-primary);">${exercises}</div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Exercícios</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-secondary);">${sets}</div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Séries</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-warning);">${Math.round(entry.totalVolume || 0)}kg</div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Volume</div>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Render mini bar chart (CSS only, no library)
     */
    renderMiniChart(data, valueKey = 'workouts', maxBars = 14) {
        const chartData = data.slice(-maxBars);
        const maxValue = Math.max(...chartData.map(d => d[valueKey]), 1);

        return `
      <div class="mini-chart" style="
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 80px;
        padding: var(--spacing-sm) 0;
      ">
        ${chartData.map(d => {
            const height = Math.max((d[valueKey] / maxValue) * 100, 4);
            const hasValue = d[valueKey] > 0;
            return `
            <div style="
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
            ">
              <div style="
                width: 100%;
                height: ${height}%;
                min-height: 4px;
                background: ${hasValue ? 'var(--gradient-primary)' : 'var(--bg-tertiary)'};
                border-radius: var(--radius-sm);
                transition: height 0.3s ease;
              " title="${d.date}: ${d[valueKey]}"></div>
              <span style="font-size: 9px; color: var(--text-muted);">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }

    /**
     * Render stats cards
     */
    renderStatsCards(stats) {
        return `
      <div class="grid grid-auto-fit" style="margin-bottom: var(--spacing-xl);">
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 20V10"></path>
              <path d="M12 20V4"></path>
              <path d="M6 20v-6"></path>
            </svg>
          </div>
          <div class="stat-value">${stats.totalWorkouts}</div>
          <div class="stat-label">Treinos no mês</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="stat-value">${this.formatDuration(stats.totalMinutes)}</div>
          <div class="stat-label">Tempo total</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"></path>
            </svg>
          </div>
          <div class="stat-value">${stats.streak}</div>
          <div class="stat-label">Dias seguidos</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </div>
          <div class="stat-value">${Math.round(stats.totalVolume / 1000)}t</div>
          <div class="stat-label">Volume total (ton)</div>
        </div>
      </div>
    `;
    }
}

// Export singleton
const historyManager = new HistoryManager();
export { historyManager };
