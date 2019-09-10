const Sequelize = require('sequelize');
const {DataTypes, Op} = Sequelize;

// const DataTypes = Sequelize.DataTypes;

// const mysql = require('mysql2');

// const connection = mysql.createConnection({
//     host: process.env.HT || '172.17.0.2',
//     user: process.env.USR || 'root',
//     password: process.env.PW || 'pruebas',
//     database: process.env.DB || 'celex'
// });

// connection.query('SELECT COUNT(*) as total FROM courses', (err, results, fields) => {
//     console.log('err : ', err);
//     console.log('results : ', results);
//     console.log('fields : ', fields);
// });

// connection
//     .then()

class Persistence {
    processData (data) {
        // console.log('processData : ', data.length);
        // console.log('processData : ', JSON.stringify(data));
        // console.log('courses : ', data.reduce((acc, v) => acc.add(v.language), new Set()));
        // console.log('grade : ', data.reduce((acc, v) => acc.add(v.level), new Set()));
        // console.log('teachers : ', data.reduce((acc, v) => acc.add(v.teacher), new Set()));
        // console.log('students : ', data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set()));

        const dataCourses = data.reduce((acc, v) => acc.add(v.language), new Set());
        const dataGrades = data.reduce((acc, v) => acc.add(v.level), new Set());
        const dataTeachers = data.reduce((acc, v) => acc.add(v.teacher), new Set());
        const dataStudents = data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set());

        const sequelize = this.getConnection();
        this.configEntities(sequelize);

        Promise.all([
            this.getCoursesPersisted(dataCourses),
            this.getGradesPersisted(dataGrades),
            this.getTeachersPersisted(dataTeachers),
            this.getStudentsPersisted(dataStudents),
        ]).then(([courses, grades, teachers, students]) => {
            let processCourses = this.processCourses(courses, dataCourses);
            let processGrades = this.processGrades(grades, dataGrades);
            let processTeachers = this.processTeachers(teachers, dataTeachers);
            let processStudents = this.processStudents(students, dataStudents);

            this.generateNewInfo(processCourses, processGrades, processTeachers, processStudents, sequelize, data)
                .then(res => console.log('transaction - done') || sequelize.close())
                .catch(err => console.log('transaction - error : ', err) || sequelize.close());
        }).catch(err => console.log('error : ', err) || sequelize.close());

        // Promise.all([
        //     this.Course.findAll(),
        //     this.Grade.findAll(),
        //     this.Student.findAll(),
        //     this.Teacher.findAll(),
        //     this.Group.findAll(),
        //     this.GroupStudent.findAll(),
        // ]).then(results => {
        //     console.log('done');
        //     console.log('data course : ', results[0]);
        //     console.log('data grade : ', results[1]);
        //     console.log('data student : ', results[2]);
        //     console.log('data teacher : ', results[3]);
        //     console.log('data group : ', results[4]);
        //     console.log('data groupStudent : ', results[5]);
        //     sequelize.close();
        //     console.log('connection closed');
        // }).catch(err => console.log('error : ', err));
    }

    generateNewInfo (processCourses, processGrades, processTeachers, processStudents, sequelize, data) {
        // console.log('processCourses => ', processCourses);
        // console.log('processGrades => ', processGrades);
        // console.log('processTeachers => ', processTeachers);
        // console.log('processStudents => ', processStudents);
        return sequelize.transaction().then(tx => Promise.all([
            this.createNewCourses(processCourses, tx),
            this.createNewGrades(processGrades, tx),
            this.createNewTeachers(processTeachers, tx),
            this.createNewStudents(processStudents, tx),
        ]).then(([newCourses, newGrades, newTeachers, newStudents]) => {
            // console.log('newCourses : ', newCourses);
            this.joinNewData(processCourses, newCourses, this.processCourses);
            this.joinNewData(processGrades, newGrades, this.processGrades);
            this.joinNewData(processTeachers, newTeachers, this.processTeachers);
            this.joinNewData(processStudents, newStudents, this.processStudents);
            // console.log('persistedAllCourses : ', processCourses.persisted);
            // console.log('persistedAllGrades : ', processGrades.persisted);
            // console.log('persistedAllTeachers : ', processTeachers.persisted);
            // console.log('persistedAllStudents : ', processStudents.persisted);
            return new Promise(solve => solve());
        }).then(async() => {
            const groups = await this.getGroups(processCourses, processGrades, processTeachers, processStudents, data, tx);
            // console.log('@@ groups size : ', groups.size);
            // tx.rollback();
            // console.log('new data - x done');
            tx.commit();
            console.log('new data - done');
        }).catch(err => {
            tx.rollback();
            console.log('new data - undone - err : ', err);
        }));
    }

    getGroups (processCourses, processGrades, processTeachers, processStudents, data, tx) {
        const dataPersisted = this.getDataPersisted(processCourses, processGrades, processTeachers, processStudents);
        const groups = [];
        let count = 0;
        for (let group of data) {
            groups.push(this.buildGroup(dataPersisted, group));
            if (count++>9) break;
        }

        // const newGroups = this.getNewGroups(groups);
        return this.getNewGroups(groups)
            .then(newGroups => this.createNewGroups(newGroups, tx));
        // console.log('# groups : ', groups.length);
        // // groups.forEach(group => console.log('@ group : ', `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}.${group.schedule}.${group.publication}.${group.classroom}`));
        // // groups.forEach(group => console.log('* group : ', `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}`));
        // // console.log('groups : ', groups.map(group => `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}`));
        // // console.log('groups : ', groups.map(group => `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}`));
        // console.log('# groups unique : ', groups.reduce((acc, group) =>
        //     // console.log('gg : ', group) || 
        //     // console.log('gg : ', group.toJSON()) || 
        //     // acc.add(`${group.get('idCourse')}.${group.get('idGrade')}.${group.get('idTeacher')}.${group.get('bimester')}`)

        //     // acc.add(`${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}`)
        //     acc.add(`${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}.${group.schedule}`)
        // , new Set()).size);
        // console.log('# groups unique : ', groups.reduce((acc, group) => acc.add(`${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}`), new Set()));
        // return groups;
        // return newGroups;
    }

    createNewGroups (newGroups, tx) {
        let data = Array.from(newGroups.values()).map(newGroup => {
            delete newGroup.grouper;
            // newGroup.students = newGroup.students.map(student => ({idStudent: student, name: ''}));
            // newGroup.relationStudents = newGroup.students.map(student => ({idGroup: 1, idStudent: student}));
            newGroup.relationStudents = newGroup.students.map(student => ({idStudent: student}));
            return newGroup;
        });

        // console.log('data group create : ', Array.from(newGroups.keys()));
        // console.log('data group create : ', Array.from(newGroups.values()));
        // console.log('data group create : ', data);
        // data.forEach(group => console.log('group relation students : ', group.relationStudents));
        const createGroups = data.map(group => this.Group.create(group, {transaction: tx, include: [ {association: this.Group.RelationStudent} ]}));
        // const createGroups = data.map(group => this.Group.create(group, {transaction: tx, include: [ this.Group.GroupStudent ]}));
        // const createGroups = data.map(group => this.Group.create(group, {transaction: tx, include: [ this.GroupRGroupStudent ]}));
        // const createGroups = data.map(group => this.Group.create(group, {transaction: tx, include: [ this.GroupStudent ]}));
        // const createGroups = data.map(group => this.Group.create(group, {transaction: tx, include: [ {association: this.GroupStudent, as: 'students'} ]}));
        // const createGroups = data.map(group => this.Group.create(group, {transaction: tx}));

        // return Promise.all([...createGroups]).then(results => {
        return Promise.all(createGroups).then(results => {
            console.log('# results : ', results.length);
            // Promise.
        }).catch(err => console.log('error insert group : ', err));
        // Promise.all(createGroups).then(results => ).catch(err => console.log(''))

        // return this.Group.bulkCreate(data, {transaction: tx, include: [ this.GroupStudent ]});
        // return this.Group.bulkCreate(data, {transaction: tx, include: [{model: this.groupStudent, as: ''}]});
        // return this.Group.bulkCreate(Array.from(newGroups), {transaction: tx});
    }

    getNewGroups (groups) {
        const groupsControl = this.getGroupsControl(groups);

        return this.Group.findAll(this.getGroupsFilter(groups))
            .then(groupsPersisted => this.reduceGroups(groupsPersisted, groupsControl))
            // .then(() => Promise.resolve(groupsControl));
            .then(() => groupsControl);
    }

    reduceGroups (groupsPersisted, groupsControl) {
        return new Promise(solve => {
            // console.log('* groups size : ', groupsControl.size);
            for (let groupPersisted of groupsPersisted) {
                let grouper = this.getGrouper(groupPersisted.dataValues);
                groupsControl.delete(grouper);
            }
            // console.log('@ groups size : ', groupsControl.size);
            solve();
        });
    }

    getGrouper (group) {
        return `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}.${group.schedule}`;
    }

    getGroupsControl (groups) {
        return groups.reduce((acc, group) =>
            acc.set(this.getGrouper(group), group)
        , new Map());
    }

    getGroupsFilter (groups) {
        return {
            where: {
                [Op.or]: groups.map(group => ({
                    idCourse: group.idCourse,
                    idGrade: group.idGrade,
                    idTeacher: group.idTeacher,
                    bimester: group.bimester,
                    schedule: group.schedule
                }))
            }
        };
    }

    buildGroup (dataPersisted, group) {
        const dataGroup = {
            // idGroup: null,
            schedule: group.schedule,
            publication: group.publication,
            bimester: group.semester,
            classroom: group.classroom,
            idCourse: this.getIdCourse(dataPersisted.courses, group.language),
            idGrade: this.getIdGrade(dataPersisted.grades, group.level),
            idTeacher: this.getIdTeacher(dataPersisted.teachers, group.teacher),
            students: this.getGroupStudents(dataPersisted.students, group.students),
        };
        dataGroup.grouper = this.getGrouper(dataGroup);
        // dataGroup.grouper = this.getGrouper: `${dataGroup.idCourse}.${dataGroup.idGrade}.${dataGroup.idTeacher}.${dataGroup.bimester}.${dataGroup.schedule}`;
        // console.log('* group : ', dataGroup);

        // return this.GroupStudent.build(dataGroup);
        return dataGroup;
    }

    getGroupStudents (persistedStudents, students) {
        return students.map(student => persistedStudents.get(student).idStudent);
    }

    getIdCourse (persistedCourses, language) {
        return persistedCourses.get(language).idCourse;
    }

    getIdGrade (persistedGrades, grade) {
        return persistedGrades.get(grade).idGrade;
    }

    getIdTeacher (persistedTeachers, teacher) {
        return persistedTeachers.get(teacher).idTeacher;
    }

    getDataPersisted (processCourses, processGrades, processTeachers, processStudents) {
        return {
            courses : processCourses.persisted,
            grades : processGrades.persisted,
            teachers : processTeachers.persisted,
            students : processStudents.persisted
        };
    }

    joinNewData (persistedData, newPersisted, processPersistence) {
        persistedData.persisted = new Map([...persistedData.persisted, ...(processPersistence(newPersisted, new Set())).persisted]);
        persistedData.newData.clear();
    }

    createNewCourses (processCourses, tx) {
        let data = Array.from(processCourses.newData).map(element => ({name: element}));
        return this.Course.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 1') || solve());
    }

    createNewGrades (processGrades, tx) {
        let data = Array.from(processGrades.newData).map(element => ({name: element}));
        return this.Grade.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 2') || solve());
    }

    createNewTeachers (processTeachers, tx) {
        let data = Array.from(processTeachers.newData).map(element => ({name: element}));
        return this.Teacher.bulkCreate(data, {transaction: tx});
        // return this.Teacher.bulkCreate(data, {transaction: tx}).then(res => new Promise(solve => {
        //     console.log('undone - pre');
        //     tx.rollback();
        //     console.log('undone - ok');
        //     solve();
        // }));
        // return new Promise(solve => console.log('message 3') || solve());
    }

    createNewStudents (processStudents, tx) {
        let data = Array.from(processStudents.newData).map(element => ({name: element}));
        return this.Student.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 4') || solve());
    }

    processCourses (courses, dataCourses) {
        // console.log('courses : ', courses);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let course of courses) {
            persisted.set(course.dataValues.name, course.dataValues);
            if (dataCourses.has(course.dataValues.name)) dataCourses.delete(course.dataValues.name);
        }

        return {
            newData : dataCourses,
            persisted
        };
    }

    processGrades (grades, dataGrades) {
        // console.log('grades : ', grades);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let grade of grades) {
            persisted.set(grade.dataValues.name, grade.dataValues);
            if (dataGrades.has(grade.dataValues.name)) dataGrades.delete(grade.dataValues.name);
        }

        return {
            newData : dataGrades,
            persisted
        };
    }

    processTeachers (teachers, dataTeachers) {
        // console.log('teachers : ', teachers);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let teacher of teachers) {
            persisted.set(teacher.dataValues.name, teacher.dataValues);
            if (dataTeachers.has(teacher.dataValues.name)) dataTeachers.delete(teacher.dataValues.name);
        }

        return {
            newData : dataTeachers,
            persisted
        };
    }

    processStudents (students, dataStudents) {
        // console.log('students : ', students);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let student of students) {
            persisted.set(student.dataValues.name, student.dataValues);
            if (dataStudents.has(student.dataValues.name)) dataStudents.delete(student.dataValues.name);
        }

        return {
            newData : dataStudents,
            persisted
        };
    }

    getCoursesPersisted (dataCourses) {
        return this.Course.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataCourses)
                }
            }
        });
    }

    getGradesPersisted (dataGrade) {
        return this.Grade.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataGrade)
                }
            }
        });
    }

    getTeachersPersisted (dataTeachers) {
        return this.Teacher.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataTeachers)
                }
            }
        });
    }

    getStudentsPersisted (dataStudents) {
        return this.Student.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataStudents)
                }
            }
        });
    }

    getConnection () {
        return new Sequelize({
            database: process.env.DB || 'celex',
            username: process.env.USR || 'root',
            host: process.env.HT || '172.17.0.2',
            port: process.env.PT || '3306',
            password: process.env.PW || 'pruebas',
            define: {
                timestamps: false
            },
            // pool: {
            //     max: 500,
            //     min: 0,
            //     idle: 30000,
            //     acquire: 60000
            // },
            logging: false,
            // options: {
            //     allowPublicKeyRetrieval: true
            // },
            dialect: process.env.DD || 'mysql'
        });
    }

    configEntities (sequelize) {
        this.Course = this.configEntityCourses(sequelize);
        this.Grade = this.configEntityGrades(sequelize);
        this.Student = this.configEntityStudents(sequelize);
        this.Teacher = this.configEntityTeachers(sequelize);
        this.Group = this.configEntityGroups(sequelize);
        // this.Group.hasOne(this.Course);
        // this.Group.hasOne(this.Grade);
        // this.Group.hasOne(this.Teacher);
        this.GroupCourse = this.Group.belongsTo(this.Course, {as: 'course', foreignKey: 'id_course'});
        this.GroupGrade = this.Group.belongsTo(this.Grade, {as: 'grade', foreignKey: 'id_grade'});
        this.GroupTeacher = this.Group.belongsTo(this.Teacher, {as: 'teacher', foreignKey: 'id_teacher'});

        this.GroupStudent = this.configEntityGroupStudent(sequelize);
        this.GroupStudent.removeAttribute('id');
        // this.GroupStudent.belongsToMany(this.Group);
        // this.GroupStudent.belongsToMany(this.Student);
        // this.Student.belongsTo(this.Group, {
        //     through: {
        //         model: this.GroupStudent,
        //         scope: {

        //         }
        //     }
        // });
        // this.Student.belongsTo(this.Group, {as: 'Group', through: 'GroupStudent'});
        // this.Group.hasMany(this.Student, {as: 'students', foreignKey: 'id_teacher'});
        // this.Group.hasMany(this.Student, {as: 'Students', through: 'GroupStudent'});

        // this.Group.GroupStudent = this.Group.belongsToMany(this.GroupStudent, {as: 'relationStudents', foreignKey: 'id_group'});
        this.Group.RelationStudent = this.Group.hasMany(this.GroupStudent, {as: 'relationStudents', foreignKey: 'id_group'});
        // this.Group.GroupStudent = this.Group.belongsTo(this.GroupStudent, {as: 'relationStudents', foreignKey: 'id_group'});

        this.GroupStudent = this.Group.belongsToMany(this.Student, {as: 'students', through: 'GroupStudent', foreignKey: 'idGroup'});
        this.StudentGroup = this.Student.belongsToMany(this.Group, {as: 'groups', through: 'GroupStudent', foreignKey: 'idStudent'});
    }

    configEntityCourses (sequelize) {
        return sequelize.define('course', {
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGrades (sequelize) {
        return sequelize.define('grade', {
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityStudents (sequelize) {
        return sequelize.define('student', {
            idStudent : {
                field: 'id_student',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : { 
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityTeachers (sequelize) {
        return sequelize.define('teacher', {
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGroups (sequelize) {
        return sequelize.define('group', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            schedule : {
                field: 'schedule',
                type: DataTypes.STRING,
                allowNull: false
            },
            publication : {
                field: 'publication',
                type: DataTypes.DATE,
                allowNull: false
            },
            bimester : {
                field: 'bimester',
                type: DataTypes.STRING,
                allowNull: false
            },
            classroom : {
                field: 'classroom',
                type: DataTypes.STRING,
                allowNull: false
            },
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        });
    }
    configEntityGroupStudent (sequelize) {
        return sequelize.define('groupStudent', {
            // idGroup : {
            //     field: 'id_group',
            //     type: DataTypes.INTEGER,
            //     allowNull: false
            // },
            idStudent : { 
                field: 'id_student',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            tableName: 'group_student'
        });
    }
}

module.exports = Persistence;