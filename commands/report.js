const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');

const MODAL_ID = 'report_modal';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Submit a field interview report'),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Field Interview Report');

    const subjectInput = new TextInputBuilder()
      .setCustomId('subject_name')
      .setLabel('Subject Roblox username')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const typeInput = new TextInputBuilder()
      .setCustomId('report_type')
      .setLabel('Report type — OCG or POI')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3)
      .setPlaceholder('OCG or POI');

    const summaryInput = new TextInputBuilder()
      .setCustomId('summary')
      .setLabel('Summary')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(typeInput),
      new ActionRowBuilder().addComponents(summaryInput),
    );

    // Stash the operator so the modal handler can use it without re-querying
    interaction.client._pendingReportOps ??= new Map();
    interaction.client._pendingReportOps.set(interaction.user.id, op);

    await interaction.showModal(modal);
  },

  // Called from index.js modalSubmit handler
  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const op = interaction.client._pendingReportOps?.get(interaction.user.id);
    interaction.client._pendingReportOps?.delete(interaction.user.id);

    if (!op) {
      // Fallback: re-check auth
      const freshOp = await requireOperator(interaction);
      if (!freshOp) return;
    }

    const subjectName = interaction.fields.getTextInputValue('subject_name').trim();
    const rawType     = interaction.fields.getTextInputValue('report_type').trim().toUpperCase();
    const summary     = interaction.fields.getTextInputValue('summary').trim();

    if (!['OCG', 'POI'].includes(rawType)) {
      return interaction.editReply({
        content: `Invalid report type **${rawType}**. Must be \`OCG\` or \`POI\`.`,
      });
    }

    const caseOfficer = op?.username ?? interaction.user.tag;

    // Try to resolve entity_id
    const entity = await get(
      `SELECT id FROM roblox_entities WHERE LOWER(username) = LOWER($1)`,
      [subjectName]
    );

    const reference = `RPT-${Date.now().toString(36).toUpperCase()}`;

    const insert = await run(
      `INSERT INTO interview_reports
         (report_type, reference, entity_id, subject_name, case_officer, summary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [rawType, reference, entity?.id ?? null, subjectName, caseOfficer, summary]
    );

    await run(
      `INSERT INTO audit_logs (action, actor, target, target_type, details)
       VALUES ('SUBMIT_REPORT', $1, $2, 'interview_report', $3)`,
      [caseOfficer, subjectName, `Ref: ${reference}`]
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Report Submitted')
      .addFields(
        { name: 'Reference',     value: reference,    inline: true },
        { name: 'Type',          value: rawType,      inline: true },
        { name: 'Subject',       value: subjectName,  inline: true },
        { name: 'Case officer',  value: caseOfficer,  inline: true },
        { name: 'Report ID',     value: String(insert.id), inline: true },
      )
      .addFields({ name: 'Summary', value: summary.slice(0, 1024) })
      .setTimestamp()
      .setFooter({ text: 'Full report available at HQ.' });

    await interaction.editReply({ embeds: [embed] });
  },

  MODAL_ID,
};
