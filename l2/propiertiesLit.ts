/// <mls fileReference="_102029_/l2/propiertiesLit.ts" enhancement="_blank" />

export function getPropierties(model: mls.editor.IModelTS): mls.l2.enhancement.IProperties[] {
    let rc: mls.l2.enhancement.IProperties[] = [];
    rc = getPropiertiesByDecorators(model);
    rc = getMoreInfoInJsDoc(model, rc)
    return rc;
}

function getDefaultPropierties(): mls.l2.enhancement.IProperties[] {
    return [
        {
            propertyName: 'class',
            propertyType: 'string',
            sectionName: 'principal',
            defaultValue: '',
            hint: 'css classes'
        },
        {
            propertyName: 'id',
            propertyType: 'string',
            sectionName: 'principal',
            defaultValue: '',
            pattern: '^[_a-zA-Z]\\w*$',
            hint: 'identifier for javascript manipulation'
        }
    ]
}

function getPropiertiesByDecorators(model:  mls.editor.IModelTS): mls.l2.enhancement.IProperties[] {
    const decorators = model.compilerResults?.decorators;
    if (!decorators) return [];
    const rc: mls.l2.enhancement.IProperties[] = [];
    const objDecorators: IDecoratorDictionary = JSON.parse(decorators);
    Object.entries(objDecorators).forEach((entrie) => {
        const item: IDecoratorDetails = entrie[1];
        if (item.type === 'PropertyDeclaration') {
            const propertyName = item.parentName;
            item.decorators.forEach((decorator) => {
                if (decorator.text.startsWith('property(')) {
                    const prop: mls.l2.enhancement.IProperties = {} as mls.l2.enhancement.IProperties;
                    const propertyType = getPropType(decorator.text)?.toLowerCase();
                    prop['alias'] = getPropAttribute(decorator.text)
                    prop.propertyName = propertyName;
                    if (propertyType) prop.propertyType = propertyType;
                    rc.push(prop);
                }
            })
        }
    });
    const defaultProps = getDefaultPropierties();
    return [...defaultProps, ...rc];
}

function getMoreInfoInJsDoc(model:  mls.editor.IModelTS, propierties: mls.l2.enhancement.IProperties[]): mls.l2.enhancement.IProperties[] {
    const devDoc = model.compilerResults?.devDoc;

    if (!devDoc) return propierties;
    const objDocs: IJSDoc[] = JSON.parse(devDoc);
    const jsDocProps = getJSDocPropierties(objDocs);
    for (let i = 0; i < propierties.length; i++) {
        let prop = propierties[i];
        const propInPropsJsDoc = jsDocProps.find((_prop) => _prop.propertyName === prop.propertyName);
        prop.propertyName = prop['alias'] || prop.propertyName;
        delete prop['alias'];
        if (propInPropsJsDoc) {
            prop = {
                ...propInPropsJsDoc, ...prop
            }
            propierties[i] = prop;
        }
    }
    return propierties;
}

function getJSDocPropierties(objDocs: IJSDoc[]): mls.l2.enhancement.IProperties[] {
    const rc: mls.l2.enhancement.IProperties[] = [];
    for (const doc of objDocs) {
        if (doc.type !== 'class') continue;
        const docMembersProp = doc.members.filter((m) => {
            const isProp = m.type === 'property'
            let isLitProp = false;
            if (isProp) {
                const { modifiers } = m;
                isLitProp = isDecoratorProp(modifiers);
            }
            return isProp && isLitProp
        });

        docMembersProp.forEach((prop) => {
            const propItem: mls.l2.enhancement.IProperties = {} as mls.l2.enhancement.IProperties;
            const fieldType = getFieldTypeInfo(prop.tags);
            const sectionName = getSectionsTag(fieldType);
            const propType = getPropTypeTag(fieldType);
            propItem.hint = prop.comment;
            propItem.propertyName = prop.name;
            propItem.defaultValue = prop.initializerText || fieldType?.defaultValue || '';
            if (propType) propItem.propertyType = propType;
            if (sectionName) propItem.sectionName = sectionName;
            if (fieldType?.cols) propItem.cols = fieldType?.cols;
            if (fieldType?.rows) propItem.rows = fieldType?.rows;
            if (fieldType?.pattern) propItem.pattern = fieldType?.pattern;
            if (fieldType?.max) propItem.max = fieldType?.max;
            if (fieldType?.min) propItem.min = fieldType?.min;
            if (fieldType?.step) propItem.step = fieldType?.step;
            if (fieldType?.maxLength) propItem.maxLength = fieldType?.maxLength;

            if (propType === 'list') {
                const itens = getItensByType(prop.initializerType);
                propItem.items = fieldType?.items || itens || [];
            }
            rc.push(propItem)
        })
    }
    return rc;
}

function getItensByType(initializerType: string) {
    if (!initializerType) return [];
    const regex = /"(.*?)"/g;
    const matches = initializerType.match(regex);
    if (matches) {
        const resultList = matches.map(match => match.replace(/"/g, ''));
        return resultList;
    }
    return [];
}

function getPropType(propertyString: string): string | undefined {
    const typeRegex = /type:\s*([A-Za-z]+)/;
    const match = propertyString.match(typeRegex);
    if (match && match.length > 1) {
        const typeProp = match[1];
        return typeProp;
    }
    return undefined;
}

function getPropAttribute(propertyString: string): string | undefined {
    const typeRegex = /attribute:\s*['"]([^'"]+)['"]/;
    const match = propertyString.match(typeRegex);
    if (match && match.length > 1) {
        const attr = match[1];
        return attr;
    }
    return undefined;
}

function isDecoratorProp(modifiers: string[]): boolean {
    if (!modifiers) return false;
    const searchStr = '@property(';
    for (const item of modifiers) {
        if (item.startsWith(searchStr)) return true;
    }
    return false;
}

function getFieldTypeInfo(tags: ITag[]): mls.l2.enhancement.IProperties | undefined{
    const tag = tags.find((item) => item.tagName === 'fieldType');
    if (!tag) return undefined;
    try {
        const rc = JSON.parse(tag.comment);
        return rc;
    } catch (err) {
        return undefined;
    }
}

function getSectionsTag(fieldType: mls.l2.enhancement.IProperties | undefined): mls.l2.enhancement.ISectionName {
    const defaultSection = 'principal'
    if (!fieldType) return defaultSection;
    const { sectionName } = fieldType;
    if (!sectionName) return defaultSection;
    const valueFormated = sectionName.toLowerCase().trim();
    if (['principal', 'optional', 'advanced'].includes(valueFormated)) return valueFormated as mls.l2.enhancement.ISectionName
    return defaultSection;
}

function getPropTypeTag(fieldType: mls.l2.enhancement.IProperties | undefined): string {
    const defaultType = 'string'
    if (!fieldType) return defaultType;
    const { propertyType } = fieldType;
    if (!propertyType) return defaultType;
    const valueFormated = propertyType.toLowerCase().trim();
    if (['string', 'number', 'boolean', 'list', 'json'].includes(valueFormated)) return valueFormated;
    return defaultType;
}

export interface IMember {
    name: string;
    pos: number;
    type: string;
    comment: string;
    modifiers: string[];
    tags: ITag[];
    parameters?: IParameter[];
    initializerText: string,
    initializerType: string
}

export interface ITag {
    name: string;
    pos: number;
    tagName: string;
    comment: string;
}

export interface IParameter {
    name: string;
    comment: string;
    type: string;
    modifiers: string[];
}

export interface IJSDoc {
    name: string;
    pos: number;
    type: string;
    comment: string;
    members: IMember[];
    tags: ITag[];
}

export interface IDecoratorClassInfo {
    decoratorName: string,
    tagName: string,
}

export interface IDecoratorItem {
    line: number;
    character: number;
    text: string;
}

export interface IDecoratorDetails {
    parentName: string;
    type: string;
    pos: number;
    decorators: IDecoratorItem[];
}

export interface IDecoratorDictionary {
    [key: number]: IDecoratorDetails
}
