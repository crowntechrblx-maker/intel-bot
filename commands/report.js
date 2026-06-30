const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS } = require('../utils/embeds');

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

    interaction.client._pendingReportOps ??= new Map();
    interaction.client._pendingReportOps.set(interaction.user.id, op);

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const op = interaction.client._pendingReportOps?.get(interaction.user.id);
    interaction.client._pendingReportOps?.delete(interaction.user.id);

    if (!op) {
      const freshOp = await requireOperator(interaction);
      if (!freshOp) return;
    }

    const subjectName = interaction.fields.getTextInputValue('subject_name').trim();
    const rawType     = interaction.fields.getTextInputValue('report_type').trim().toUpperCase();
    const summary     = interaction.fields.getTextInputValue('summary').trim();

    if (!['OCG', 'POI'].includes(rawType)) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Invalid Report Type')
            .setDescription(`**${rawType}** is not valid. Must be \`OCG\` or \`POI\`.`),
        ],
      });
    }

    const caseOfficer = op?.username ?? interaction.user.tag;
    const entity = await get(
      `SELECT id FROM roblox_entities WHERE LOWER(username) = LOWER($1)`,
      [subjectName]
    );

    const reference = `RPT-${Date.now().toString(36).toUpperCase()}`;

    const insert = await run(
      `INSERT INTO interview_reports
         (report_type, reference, entity_id, subject_name, case_officer, summary)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [rawType, reference, entity?.id ?? null, subjectName, caseOfficer, summary]
    );

    await run(
      `INSERT INTO audit_logs (action, actor, target, target_type, details)
       VALUES ('SUBMIT_REPORT', $1, $2, 'interview_report', $3)`,
      [caseOfficer, subjectName, `Ref: ${reference}`]
    );

    const typeColor = rawType === 'OCG' ? COLORS.RED : COLORS.BLUE;

    const embed = base(typeColor)
      .setAuthor({ name: 'MI5 Intel Portal — Field Report Submitted' })
      .setTitle(`📄  Report Filed — ${rawType}`)
      .addFields(
        { name: '🔖  Reference',    value: `\`${reference}\``,   inline: true },
        { name: '📋  Type',         value: rawType,               inline: true },
        { name: '🆔  Report ID',    value: `\`${insert.id}\``,   inline: true },
        { name: '🎯  Subject',      value: subjectName,           inline: true },
        { name: '👤  Case Officer', value: caseOfficer,           inline: true },
      )
      .addFields({ name: '📝  Summary', value: summary.slice(0, 1024) })
      .setFooter({ text: 'MI5 Intel Portal — Full report available at HQ' });

    await interaction.editReply({ embeds: [embed] });
  },

  MODAL_ID,
};
