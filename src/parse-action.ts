import { ActionDefinition } from "./action/action-definition";
import { ActionDictionary } from "./action/action-dictionary";
import { getUsageText } from "./message";
import { MULTILINE_DELIMITER } from "./util";

type ParseResult =
  | {
      type: "success";
      action: Action;
    }
  | { type: "error"; message: string };

export interface Action {
  actionDef: ActionDefinition;
  parameters: Record<string, string>;
}

export default function parseAction(
  dict: ActionDictionary,
  text: string
): ParseResult {
  text = `name: ${text.trim()}`;

  try {
    const jsonText =
      "{" +
      text
        .split(MULTILINE_DELIMITER)
        .map((part) => part.trim())
        .map((part, i) => {
          if (i % 2 === 0) return part;
          const escaped = JSON.stringify(part);
          return escaped.substring(1, escaped.length - 1);
        })
        .join("")
        .split("\n")
        .map((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex < 0) throw new Error("line is missing a colon");
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          return `"${key}": "${value}"`;
        })
        .join(",") +
      "}";

    const { name, ...parameters } = JSON.parse(jsonText);

    const actionDef = dict.getDefinition(name);
    if (!actionDef)
      return {
        type: "error",
        message: `Unknown action \`${name}\`, please consult \`help\`.`,
      };

    const missingProps = Object.entries(actionDef.parameters)
      .filter(
        ([name, parameterDef]) =>
          !parameterDef.optional && !(name in parameters)
      )
      .map(([name]) => name);
    if (missingProps.length) {
      return {
        type: "error",
        message: `Missing required argument${
          missingProps.length > 1 ? "s" : ""
        } ${missingProps.map((p) => `\`${p}\``)}. ${getUsageText(actionDef)}`,
      };
    }

    const extraProps = Object.keys(parameters).filter(
      (p) => !(p in actionDef.parameters)
    );
    if (extraProps.length) {
      return {
        type: "error",
        message: `Extraneous argument${
          extraProps.length > 1 ? "s" : ""
        } ${extraProps.map((p) => `\`${p}\``)}. ${getUsageText(actionDef)}`,
      };
    }

    return { type: "success", action: { actionDef, parameters } };
  } catch (e: any) {
    return {
      type: "error",
      message: "Your action could not be parsed.",
    };
  }
}
