import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";

export class AnnouncementDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 160)
  title!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 10000)
  body!: string;
  @IsIn(["ALL_BUYERS", "SELECTED_BUYERS"]) audience!: "ALL_BUYERS" | "SELECTED_BUYERS";
  @IsArray() @ArrayMaxSize(500) @ArrayUnique() @IsUUID("4", { each: true }) buyerIds: string[] = [];
}
export class PageDto {
  @IsOptional() @IsUUID() cursor?: string;
}
export class AnnouncementListDto extends PageDto {
  @IsOptional() @IsIn(["DRAFT", "PUBLISHED"]) status?: "DRAFT" | "PUBLISHED";
}
export class BuyerSearchDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
