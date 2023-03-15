import { buffer } from "stream/consumers";
import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("volume", "Adjust bot volume.");
        this.addNumberOption(builder =>
            builder.setName("volume")
            .setDescription("Volume. Default is 1.")
            .setMinValue(0.5)
            .setMaxValue(2)
            .setRequired(true)    
        )
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        let givenVolume = interaction.options.getNumber("volume", true);
        if(typeof givenVolume != "number") return interaction.reply({content: "Provide a valid value", ephemeral: true});

        givenVolume = Math.min(Math.max(givenVolume, 0.5), 2);

        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.reply("I am not in a Voice Channel.")
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.reply("Please join the Voice Channel first.");
    
        let outcome = audio.AdjustVolume(givenVolume, member);
        interaction.reply(outcome);
    }
}