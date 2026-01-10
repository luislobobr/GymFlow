/**
 * GymFlow - PDF Export Module
 * Generate PDF documents for workouts, assessments, and reports
 * Uses browser print functionality for PDF generation (no external libraries)
 */

class PDFExporter {
    constructor() {
        this.styles = `
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #1a1a1a;
          background: white;
        }
        
        .pdf-container {
          max-width: 100%;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 15px;
          border-bottom: 2px solid #10b981;
          margin-bottom: 20px;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #10b981, #06b6d4);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 18px;
        }
        
        .logo-text {
          font-size: 24px;
          font-weight: 700;
          color: #10b981;
        }
        
        .date {
          color: #666;
          font-size: 11px;
        }
        
        h1 {
          font-size: 22px;
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        
        h2 {
          font-size: 16px;
          color: #10b981;
          margin: 20px 0 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e5e5e5;
        }
        
        h3 {
          font-size: 14px;
          color: #333;
          margin: 15px 0 8px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 15px 0;
        }
        
        .info-box {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
        }
        
        .info-value {
          font-size: 20px;
          font-weight: 700;
          color: #10b981;
        }
        
        .info-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #e5e5e5;
        }
        
        th {
          background: #f5f5f5;
          font-weight: 600;
          color: #333;
          font-size: 11px;
          text-transform: uppercase;
        }
        
        tr:nth-child(even) {
          background: #fafafa;
        }
        
        .exercise-row td:first-child {
          font-weight: 500;
        }
        
        .tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          background: #e5e5e5;
        }
        
        .tag-primary {
          background: #10b981;
          color: white;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          color: #999;
          font-size: 10px;
        }
        
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        
        .notes {
          background: #fffef0;
          border-left: 3px solid #f59e0b;
          padding: 10px 15px;
          margin: 15px 0;
          font-size: 11px;
        }
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    `;
    }

    /**
     * Generate PDF header
     */
    getHeader(title, subtitle = '') {
        const date = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        return `
      <div class="header">
        <div class="logo">
          <div class="logo-icon">GF</div>
          <div>
            <div class="logo-text">GymFlow</div>
          </div>
        </div>
        <div class="date">
          <div>${title}</div>
          <div style="font-weight: 500;">${date}</div>
        </div>
      </div>
      ${subtitle ? `<p style="color: #666; margin-bottom: 20px;">${subtitle}</p>` : ''}
    `;
    }

    /**
     * Generate PDF footer
     */
    getFooter() {
        return `
      <div class="footer">
        Gerado por GymFlow • ${new Date().toLocaleString('pt-BR')}
      </div>
    `;
    }

    /**
     * Export workout to PDF
     */
    exportWorkout(workout) {
        const exercises = workout.exercises || [];
        const totalTime = exercises.reduce((sum, ex) => {
            return sum + ((ex.sets || 3) * 1) + ((ex.rest || 60) / 60 * (ex.sets || 3));
        }, 0);

        const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${workout.name} - GymFlow</title>
        ${this.styles}
      </head>
      <body>
        <div class="pdf-container">
          ${this.getHeader('Ficha de Treino')}
          
          <h1>${workout.name}</h1>
          ${workout.description ? `<p style="color: #666;">${workout.description}</p>` : ''}
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-value">${exercises.length}</div>
              <div class="info-label">Exercícios</div>
            </div>
            <div class="info-box">
              <div class="info-value">~${Math.round(totalTime)}min</div>
              <div class="info-label">Tempo Estimado</div>
            </div>
            <div class="info-box">
              <div class="info-value">${workout.difficulty || 'Médio'}</div>
              <div class="info-label">Nível</div>
            </div>
          </div>
          
          <h2>📋 Lista de Exercícios</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 35%;">Exercício</th>
                <th style="width: 15%;">Séries</th>
                <th style="width: 15%;">Repetições</th>
                <th style="width: 15%;">Descanso</th>
                <th style="width: 15%;">Carga</th>
              </tr>
            </thead>
            <tbody>
              ${exercises.map((ex, i) => `
                <tr class="exercise-row">
                  <td>${i + 1}</td>
                  <td>${ex.name}</td>
                  <td>${ex.sets || 3}</td>
                  <td>${ex.reps || '10-12'}</td>
                  <td>${ex.rest || 60}s</td>
                  <td>______kg</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="notes">
            <strong>📝 Observações:</strong><br>
            ${workout.notes || 'Aquecer antes do treino. Manter boa postura durante os exercícios. Hidratar-se regularmente.'}
          </div>
          
          ${this.getFooter()}
        </div>
        
        <script>
          window.onload = () => window.print();
        </script>
      </body>
      </html>
    `;

        this.openPrintWindow(html, `treino_${workout.name.replace(/\s+/g, '_')}`);
    }

    /**
     * Export assessment report to PDF
     */
    exportAssessment(anamnesis, measurements = null, userName = 'Aluno') {
        const data = anamnesis?.data || {};
        const date = anamnesis?.date ? new Date(anamnesis.date).toLocaleDateString('pt-BR') : 'N/A';

        const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Avaliação Física - ${userName} - GymFlow</title>
        ${this.styles}
      </head>
      <body>
        <div class="pdf-container">
          ${this.getHeader('Avaliação Física', `Aluno: ${userName} | Data: ${date}`)}
          
          <div class="section">
            <h2>📋 Dados Pessoais</h2>
            <div class="info-grid">
              ${data.age ? `<div class="info-box"><div class="info-value">${data.age}</div><div class="info-label">Idade (anos)</div></div>` : ''}
              ${data.height ? `<div class="info-box"><div class="info-value">${data.height}</div><div class="info-label">Altura (cm)</div></div>` : ''}
              ${measurements?.weight ? `<div class="info-box"><div class="info-value">${measurements.weight}</div><div class="info-label">Peso (kg)</div></div>` : ''}
            </div>
            ${data.objectives ? `
              <h3>Objetivos</h3>
              <p>${Array.isArray(data.objectives) ? data.objectives.join(', ') : data.objectives}</p>
            ` : ''}
          </div>
          
          ${data.diseases || data.medications ? `
            <div class="section">
              <h2>❤️ Histórico de Saúde</h2>
              ${data.diseases ? `
                <h3>Doenças</h3>
                <p>${Array.isArray(data.diseases) ? data.diseases.join(', ') : data.diseases}</p>
              ` : ''}
              ${data.medications ? `
                <h3>Medicamentos</h3>
                <p>${data.medications}</p>
              ` : ''}
              ${data.injuries ? `
                <h3>Lesões ou Dores</h3>
                <p>${data.injuries}</p>
              ` : ''}
            </div>
          ` : ''}
          
          ${data.activityLevel || data.sleepHours ? `
            <div class="section">
              <h2>🏃 Estilo de Vida</h2>
              <table>
                <tbody>
                  ${data.activityLevel ? `<tr><td><strong>Nível de Atividade</strong></td><td>${data.activityLevel}</td></tr>` : ''}
                  ${data.exerciseFrequency ? `<tr><td><strong>Frequência de Treino</strong></td><td>${data.exerciseFrequency}</td></tr>` : ''}
                  ${data.sleepHours ? `<tr><td><strong>Horas de Sono</strong></td><td>${data.sleepHours}h por noite</td></tr>` : ''}
                  ${data.sleepQuality ? `<tr><td><strong>Qualidade do Sono</strong></td><td>${data.sleepQuality}</td></tr>` : ''}
                  ${data.stressLevel ? `<tr><td><strong>Nível de Estresse</strong></td><td>${data.stressLevel}</td></tr>` : ''}
                  ${data.smoking ? `<tr><td><strong>Fumante</strong></td><td>${data.smoking}</td></tr>` : ''}
                  ${data.alcohol ? `<tr><td><strong>Consumo de Álcool</strong></td><td>${data.alcohol}</td></tr>` : ''}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${measurements ? `
            <div class="section">
              <h2>📏 Medidas Corporais</h2>
              <table>
                <tbody>
                  ${measurements.weight ? `<tr><td><strong>Peso</strong></td><td>${measurements.weight} kg</td></tr>` : ''}
                  ${measurements.bodyFat ? `<tr><td><strong>% Gordura</strong></td><td>${measurements.bodyFat}%</td></tr>` : ''}
                  ${measurements.chest ? `<tr><td><strong>Peito</strong></td><td>${measurements.chest} cm</td></tr>` : ''}
                  ${measurements.waist ? `<tr><td><strong>Cintura</strong></td><td>${measurements.waist} cm</td></tr>` : ''}
                  ${measurements.hips ? `<tr><td><strong>Quadril</strong></td><td>${measurements.hips} cm</td></tr>` : ''}
                  ${measurements.bicepsRight ? `<tr><td><strong>Bíceps Dir.</strong></td><td>${measurements.bicepsRight} cm</td></tr>` : ''}
                  ${measurements.bicepsLeft ? `<tr><td><strong>Bíceps Esq.</strong></td><td>${measurements.bicepsLeft} cm</td></tr>` : ''}
                  ${measurements.thighRight ? `<tr><td><strong>Coxa Dir.</strong></td><td>${measurements.thighRight} cm</td></tr>` : ''}
                  ${measurements.thighLeft ? `<tr><td><strong>Coxa Esq.</strong></td><td>${measurements.thighLeft} cm</td></tr>` : ''}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${this.getFooter()}
        </div>
        
        <script>
          window.onload = () => window.print();
        </script>
      </body>
      </html>
    `;

        this.openPrintWindow(html, `avaliacao_${userName.replace(/\s+/g, '_')}`);
    }

    /**
     * Export student report
     */
    exportStudentReport(student, workouts = [], history = []) {
        const totalWorkouts = history.length;
        const totalMinutes = history.reduce((sum, h) => sum + (h.durationMinutes || 0), 0);
        const totalVolume = history.reduce((sum, h) => sum + (h.totalVolume || 0), 0);

        const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório - ${student.name} - GymFlow</title>
        ${this.styles}
      </head>
      <body>
        <div class="pdf-container">
          ${this.getHeader('Relatório do Aluno', `Personal Trainer`)}
          
          <h1>${student.name}</h1>
          ${student.email ? `<p style="color: #666;">📧 ${student.email}</p>` : ''}
          ${student.phone ? `<p style="color: #666;">📱 ${student.phone}</p>` : ''}
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-value">${totalWorkouts}</div>
              <div class="info-label">Treinos Realizados</div>
            </div>
            <div class="info-box">
              <div class="info-value">${Math.round(totalMinutes / 60)}h</div>
              <div class="info-label">Tempo Total</div>
            </div>
            <div class="info-box">
              <div class="info-value">${Math.round(totalVolume / 1000)}t</div>
              <div class="info-label">Volume Total</div>
            </div>
          </div>
          
          ${student.objective ? `
            <div class="section">
              <h2>🎯 Objetivo</h2>
              <p><span class="tag tag-primary">${student.objective}</span></p>
            </div>
          ` : ''}
          
          ${workouts.length > 0 ? `
            <div class="section">
              <h2>📋 Treinos Atribuídos</h2>
              <table>
                <thead>
                  <tr>
                    <th>Treino</th>
                    <th>Exercícios</th>
                  </tr>
                </thead>
                <tbody>
                  ${workouts.map(w => `
                    <tr>
                      <td><strong>${w.name}</strong></td>
                      <td>${w.exercises?.length || 0} exercícios</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          ${student.notes ? `
            <div class="notes">
              <strong>📝 Observações:</strong><br>
              ${student.notes}
            </div>
          ` : ''}
          
          ${this.getFooter()}
        </div>
        
        <script>
          window.onload = () => window.print();
        </script>
      </body>
      </html>
    `;

        this.openPrintWindow(html, `relatorio_${student.name.replace(/\s+/g, '_')}`);
    }

    /**
     * Open print window
     */
    openPrintWindow(html, filename) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            toast?.warning('Por favor, permita popups para exportar PDF');
        }
    }
}

// Export singleton
const pdfExporter = new PDFExporter();
export { pdfExporter };
