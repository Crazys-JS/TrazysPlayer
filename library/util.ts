import { DMChannel, GuildMember, Message, MessageComponentInteraction, TextChannel, User } from "discord.js";

const NameRegex = /[`@#$%^&*()_+=\[\]{};:"\\|,.<>\/?~]/i;

/**Results of an action. */
export interface ActionResult<T> {
    success: boolean,
    result?: T
};

/**Results of the AwaitResponse function. */
export interface ResponseResult<T> {
    success: boolean,
    result?: T,
    message?: Message
};

/**Validifies user given name string. */
export function ValidifyName(given: string, maxLength: number = 30, minLength: number = 3): ActionResult<string> {
    if(given.length < minLength) return {success: false, result: `Given name cannot be shorter than ${minLength} characters!`}
    if(given.length > maxLength) return {success: false, result: `Given name cannot be longer than ${maxLength} characters!`};
    
    const valid = NameRegex.test(given);
    if(valid) return {success: false, result: `Given name not valid.`};

    return {
        success: true
    }
};

/**Await response from a specific user in a specific channel. */
export async function AwaitResponse(channel: TextChannel | DMChannel, user: User|GuildMember, timeout:number = 10000): Promise<ResponseResult<string>> {
    try {

        const filter = (message: Message) => message.author.id == user.id;
        const response = await channel.awaitMessages({max: 1, time: timeout, filter: filter});

        const first = response.first();
        if(!first) return {
            success: false,
            result: "You didn't respond in time."
        };

        const content = first.content;
        return {
            success: true,
            result: content,
            message: first
        }

    } catch {
        return {
            success: false,
            result: "Something went wrong."
        };
    }
};

export function VerifyImageURL(url: string): boolean {
    return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
};

export function VerifyHexColor(str: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(str);
};

/**Stolen from https://stackoverflow.com/a/28735961 lol */
export function MatchYoutubeURL(url: string): boolean {
    var p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
    return p.test(url);
};

export function VideoFormatMilliseconds(milliseconds: number): string {
    let hours = Math.floor(milliseconds / (1000 * 60 * 60));
    milliseconds -= hours * 1000 * 60 * 60;
    let minutes = Math.floor(milliseconds / (1000 * 60));
    milliseconds -= minutes * 1000 * 60;
    let seconds = Math.floor(milliseconds / (1000));
    milliseconds -= seconds * 1000;

    let temp: string[] = [];
    if(hours) temp.push(hours.toString());
    temp.push(minutes.toString());
    temp.push(seconds.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    }));

    return temp.join(':');
};

/**
 * Stop execution for **t** seconds.
 * @param t In seconds.
 * @returns void
 */
export function Sleep(t: number): Promise<void> {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, t * 1000);
    });
};